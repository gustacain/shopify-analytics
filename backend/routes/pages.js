const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/pages — all pages with analytics stats, optional filters
router.get('/', (req, res) => {
  const { from, to, device } = req.query;

  const conditions = ["page_url IS NOT NULL AND page_url != ''"];
  const params     = [];

  if (from)   { conditions.push('created_at >= ?'); params.push(from); }
  if (to)     { conditions.push('created_at <= ?'); params.push(to); }
  if (device) { conditions.push('device_type = ?'); params.push(device); }

  const where = conditions.join(' AND ');

  const pages = db.prepare(`
    SELECT
      page_url,
      COUNT(DISTINCT session_id)                                 AS sessions,
      SUM(CASE WHEN event_type = 'click'     THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN event_type = 'scroll'    THEN 1 ELSE 0 END) AS scroll_events,
      MAX(created_at)                                            AS last_seen,
      MAX(device_type)                                           AS top_device
    FROM events
    WHERE ${where}
    GROUP BY page_url
    ORDER BY sessions DESC
    LIMIT 500
  `).all(...params);

  res.json({ pages, total: pages.length });
});

module.exports = router;
