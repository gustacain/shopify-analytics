const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── Session list ──────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { page, from, to, device, limit = 50, offset = 0 } = req.query;

  const conditions = ['1=1'];
  const params     = [];

  if (page)   { conditions.push('page_url = ?');    params.push(page); }
  if (from)   { conditions.push('created_at >= ?'); params.push(from); }
  if (to)     { conditions.push('created_at <= ?'); params.push(to); }
  if (device) { conditions.push('device_type = ?'); params.push(device); }

  const where = conditions.join(' AND ');

  const sessions = db.prepare(`
    SELECT
      session_id,
      MIN(created_at)                                          AS start_time,
      MAX(created_at)                                          AS end_time,
      MAX(device_type)                                         AS device_type,
      MAX(screen_width)                                        AS screen_width,
      MAX(screen_height)                                       AS screen_height,
      COUNT(*)                                                 AS event_count,
      SUM(CASE WHEN event_type='click'     THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN event_type='purchase'  THEN 1 ELSE 0 END) AS converted,
      MAX(time_on_page)                                        AS time_on_page,
      MAX(scroll_percent)                                      AS max_scroll,
      GROUP_CONCAT(page_url, '|||')                            AS pages_visited
    FROM events
    WHERE ${where}
    GROUP BY session_id
    ORDER BY start_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));

  const total = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE ${where}
  `).get(...params).c;

  res.json({ sessions, total, limit: Number(limit), offset: Number(offset) });
});

// ── Rage click detection ──────────────────────────────────────────────────────
// Returns Set of event IDs that belong to rage-click clusters
// (3+ clicks within 2s and 60px radius)
function rageClickIds(clicks) {
  const ids = new Set();
  for (let i = 0; i < clicks.length; i++) {
    const cluster = [i];
    const a = clicks[i];
    for (let j = i + 1; j < clicks.length; j++) {
      const b = clicks[j];
      if (b.t - a.t > 2000) break;
      if (Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0)) <= 60) {
        cluster.push(j);
      }
    }
    if (cluster.length >= 3) cluster.forEach(k => ids.add(clicks[k].id));
  }
  return ids;
}

// ── Summary ───────────────────────────────────────────────────────────────────
// GET /api/sessions/:id/summary — must be before /:sessionId
router.get('/:sessionId/summary', (req, res) => {
  const events = db.prepare(
    `SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC`
  ).all(req.params.sessionId);

  if (!events.length) return res.status(404).json({ error: 'Session not found' });

  const start = new Date(events[0].created_at);
  const end   = new Date(events.at(-1).created_at);

  const clicks = events.filter(e => e.event_type === 'click');

  // Compute rage clicks using ms offset
  const startMs = start.getTime();
  const clicksT = clicks.map(e => ({ ...e, t: new Date(e.created_at).getTime() - startMs }));
  const rage    = rageClickIds(clicksT);

  res.json({
    session_id:         req.params.sessionId,
    start_time:         events[0].created_at,
    end_time:           events.at(-1).created_at,
    duration_s:         Math.round((end - start) / 1000),
    pages_visited:      [...new Set(events.filter(e => e.page_url).map(e => e.page_url))],
    total_clicks:       clicks.length,
    max_scroll_percent: Math.max(0, ...events.filter(e => e.scroll_percent != null).map(e => e.scroll_percent)),
    converted:          events.some(e => e.event_type === 'purchase'),
    has_rage_clicks:    rage.size > 0,
    rage_click_count:   rage.size,
    device_type:        events[0]?.device_type || 'desktop',
    event_count:        events.length,
  });
});

// ── Replay ────────────────────────────────────────────────────────────────────
// GET /api/sessions/:id/replay — must be before /:sessionId
router.get('/:sessionId/replay', (req, res) => {
  const rows = db.prepare(`
    SELECT id, session_id, event_type, page_url,
           x, y, viewport_width, viewport_height,
           scroll_percent, time_on_page, created_at
    FROM events
    WHERE session_id = ?
      AND event_type IN ('page_view', 'click', 'mouse_move', 'scroll', 'page_exit')
    ORDER BY created_at ASC
  `).all(req.params.sessionId);

  if (!rows.length) return res.status(404).json({ error: 'Session not found' });

  const startMs = new Date(rows[0].created_at).getTime();
  const events  = rows.map(e => ({ ...e, t: new Date(e.created_at).getTime() - startMs }));

  const clicks = events.filter(e => e.event_type === 'click');
  const rage   = rageClickIds(clicks);

  res.json({
    session_id:  req.params.sessionId,
    duration_ms: events.at(-1)?.t || 0,
    events:      events.map(e => ({ ...e, rage_click: rage.has(e.id) })),
  });
});

// ── Single session (all events) ───────────────────────────────────────────────
router.get('/:sessionId', (req, res) => {
  const events = db.prepare(
    `SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC`
  ).all(req.params.sessionId);

  if (!events.length) return res.status(404).json({ error: 'Session not found' });
  res.json({ session_id: req.params.sessionId, events });
});

module.exports = router;
