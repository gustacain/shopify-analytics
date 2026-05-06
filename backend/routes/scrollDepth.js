const express = require('express');
const router  = express.Router();
const db      = require('../db');

const THRESHOLDS = [25, 50, 75, 100];

router.get('/', (req, res) => {
  const { page, from, to, device } = req.query;

  const conditions = ['1=1'];
  const params     = [];

  if (page)   { conditions.push('page_url = ?');    params.push(page); }
  if (from)   { conditions.push('created_at >= ?'); params.push(from); }
  if (to)     { conditions.push('created_at <= ?'); params.push(to); }
  if (device) { conditions.push('device_type = ?'); params.push(device); }

  const where = conditions.join(' AND ');

  const totalSessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE ${where}
  `).get(...params).c;

  const data = THRESHOLDS.map(threshold => {
    const sessions = db.prepare(`
      SELECT COUNT(DISTINCT session_id) AS c FROM events
      WHERE event_type = 'scroll' AND scroll_percent >= ? AND ${where}
    `).get(threshold, ...params).c;

    return {
      threshold,
      sessions,
      pct: totalSessions > 0 ? Math.round((sessions / totalSessions) * 100) : 0,
    };
  });

  res.json({ total_sessions: totalSessions, scroll_depth: data });
});

module.exports = router;
