const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Prepare once; node:sqlite named params use @name in SQL, object key without sigil.
const insertStmt = db.prepare(`
  INSERT INTO events (
    session_id, event_type, page_url,
    x, y, viewport_width, viewport_height,
    element, scroll_percent, time_on_page,
    device_type, screen_width, screen_height,
    user_agent, metadata
  ) VALUES (
    @session_id, @event_type, @page_url,
    @x, @y, @viewport_width, @viewport_height,
    @element, @scroll_percent, @time_on_page,
    @device_type, @screen_width, @screen_height,
    @user_agent, @metadata
  )
`);

router.post('/', (req, res) => {
  // express.text() sets body as string when Content-Type is text/plain (sendBeacon)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  const raw = Array.isArray(body) ? body : [body];

  if (raw.length > 100) {
    return res.status(400).json({ error: 'Max 100 events per request' });
  }

  const rows = raw.map(e => ({
    session_id:      String(e.session_id  || 'unknown').slice(0, 64),
    event_type:      String(e.event_type  || 'unknown').slice(0, 32),
    page_url:        e.page_url      ? String(e.page_url).slice(0, 500)      : null,
    x:               e.x      != null ? Number(e.x)                          : null,
    y:               e.y      != null ? Number(e.y)                          : null,
    viewport_width:  e.viewport_width  ? Number(e.viewport_width)            : null,
    viewport_height: e.viewport_height ? Number(e.viewport_height)           : null,
    element:         e.element     ? String(e.element).slice(0, 255)         : null,
    scroll_percent:  e.scroll_percent != null ? Number(e.scroll_percent)     : null,
    time_on_page:    e.time_on_page   != null ? Number(e.time_on_page)       : null,
    device_type:     e.device_type ? String(e.device_type).slice(0, 16)      : 'desktop',
    screen_width:    e.screen_width  ? Number(e.screen_width)                : null,
    screen_height:   e.screen_height ? Number(e.screen_height)               : null,
    user_agent:      e.user_agent  ? String(e.user_agent).slice(0, 300)      : null,
    metadata:        e.metadata    ? JSON.stringify(e.metadata)              : null,
  }));

  // Manual transaction (node:sqlite has no .transaction() helper)
  db.exec('BEGIN');
  try {
    for (const row of rows) insertStmt.run(row);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'DB insert failed' });
  }

  setImmediate(checkCartAbandonment);
  res.status(201).json({ saved: rows.length });
});

function checkCartAbandonment() {
  try {
    const config = db.prepare('SELECT * FROM webhook_config WHERE id = 1').get();
    if (!config?.n8n_url) return;

    const since = new Date(Date.now() - 86_400_000).toISOString();

    const cartSessions = db.prepare(
      `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url LIKE '%/cart%' AND created_at > ?`
    ).get(since).c;

    if (!cartSessions) return;

    const checkoutSessions = db.prepare(
      `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url LIKE '%/checkout%' AND created_at > ?`
    ).get(since).c;

    const abandonRate = 1 - checkoutSessions / cartSessions;
    if (abandonRate < config.cart_threshold) return;

    const lastAlert = config.last_cart_alert ? new Date(config.last_cart_alert) : null;
    if (lastAlert && Date.now() - lastAlert < 3_600_000) return;

    sendN8n(config.n8n_url, {
      type:              'cart_abandonment_alert',
      abandon_rate_pct:  Math.round(abandonRate * 100),
      threshold_pct:     Math.round(config.cart_threshold * 100),
      cart_sessions:     cartSessions,
      checkout_sessions: checkoutSessions,
      window:            'last_24h',
      ts:                new Date().toISOString(),
    });

    db.prepare(`UPDATE webhook_config SET last_cart_alert = datetime('now') WHERE id = 1`).run();
  } catch (e) {
    console.error('[cart-check]', e.message);
  }
}

async function sendN8n(url, payload) {
  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[n8n] ${payload.type} -> ${res.status}`);
  } catch (e) {
    console.error('[n8n]', e.message);
  }
}

module.exports = router;
