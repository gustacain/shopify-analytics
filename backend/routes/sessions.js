const express = require('express');
const router  = express.Router();
const db      = require('../db');

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
      MIN(created_at)                          AS start_time,
      MAX(created_at)                          AS end_time,
      MAX(device_type)                         AS device_type,
      MAX(screen_width)                        AS screen_width,
      MAX(screen_height)                       AS screen_height,
      COUNT(*)                                 AS event_count,
      SUM(CASE WHEN event_type='click'      THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN event_type='page_view'  THEN 1 ELSE 0 END) AS page_views,
      MAX(time_on_page)                        AS time_on_page,
      MAX(scroll_percent)                      AS max_scroll,
      GROUP_CONCAT(page_url, '|||')            AS pages_visited
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

// Single session events (for replay)
router.get('/:sessionId', (req, res) => {
  const events = db.prepare(`
    SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC
  `).all(req.params.sessionId);

  if (!events.length) return res.status(404).json({ error: 'Session not found' });
  res.json({ session_id: req.params.sessionId, events });
});

module.exports = router;
