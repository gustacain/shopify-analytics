const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET config
router.get('/config', (_req, res) => {
  const config = db.prepare('SELECT id, n8n_url, cart_threshold, updated_at FROM webhook_config WHERE id = 1').get();
  res.json(config || {});
});

// POST config
router.post('/config', (req, res) => {
  const { n8n_url, cart_threshold } = req.body;

  db.prepare(`
    UPDATE webhook_config
    SET n8n_url = ?, cart_threshold = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(n8n_url || null, parseFloat(cart_threshold) || 0.7);

  res.json({ ok: true });
});

// Incoming webhook from n8n (trigger actions)
router.post('/n8n', async (req, res) => {
  const { action } = req.body;

  if (action === 'daily_summary') {
    const config = db.prepare('SELECT n8n_url FROM webhook_config WHERE id = 1').get();
    if (config?.n8n_url) await sendDailySummary(config.n8n_url);
  }

  res.json({ received: true, action: action || null });
});

// Manual trigger for daily summary
router.post('/daily-summary', async (req, res) => {
  const config = db.prepare('SELECT n8n_url FROM webhook_config WHERE id = 1').get();

  if (!config?.n8n_url) {
    return res.status(400).json({ error: 'n8n URL not configured. Set it in /api/webhook/config first.' });
  }

  await sendDailySummary(config.n8n_url);
  res.json({ ok: true, message: 'Daily summary dispatched' });
});

async function sendDailySummary(url) {
  const since = new Date(Date.now() - 86_400_000).toISOString();

  const q = (sql, ...p) => db.prepare(sql).get(...p);

  const pageViews      = q(`SELECT COUNT(*) AS c FROM events WHERE event_type='page_view' AND created_at>?`, since).c;
  const sessions       = q(`SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE created_at>?`, since).c;
  const clicks         = q(`SELECT COUNT(*) AS c FROM events WHERE event_type='click' AND created_at>?`, since).c;
  const cartSessions   = q(`SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url LIKE '%/cart%' AND created_at>?`, since).c;
  const purchases      = q(`SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url LIKE '%/orders/%' AND created_at>?`, since).c;
  const abandonedCarts = Math.max(0, cartSessions - purchases);
  const convRate       = cartSessions > 0 ? Math.round((purchases / cartSessions) * 100) : 0;
  const abandonRate    = cartSessions > 0 ? Math.round((abandonedCarts / cartSessions) * 100) : 0;

  const topPages = db.prepare(`
    SELECT page_url, COUNT(DISTINCT session_id) AS sessions
    FROM events WHERE event_type='page_view' AND created_at>?
    GROUP BY page_url ORDER BY sessions DESC LIMIT 5
  `).all(since);

  const payload = {
    type:              'daily_summary',
    date:              new Date().toLocaleDateString('pt-BR'),
    page_views:        pageViews,
    sessions,
    clicks,
    cart_sessions:     cartSessions,
    purchases,
    abandoned_carts:   abandonedCarts,
    conversion_rate:   `${convRate}%`,
    abandon_rate:      `${abandonRate}%`,
    top_pages:         topPages,
    ts:                new Date().toISOString(),
  };

  try {
    const { default: fetch } = await import('node-fetch');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    console.log(`[n8n] daily_summary -> ${r.status}`);
  } catch (e) {
    console.error('[n8n] daily_summary failed:', e.message);
  }
}

module.exports = router;
