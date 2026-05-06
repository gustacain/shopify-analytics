const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (req, res) => {
  const { page, from, to, device } = req.query;

  if (!page) return res.status(400).json({ error: 'Query param "page" is required' });

  // Match exact path AND URLs that start with the path followed by '?' (query params)
  // so '/products/tenis' matches both '/products/tenis' and '/products/tenis?variant=123'
  const conditions = ['event_type = ?', "(page_url = ? OR page_url LIKE ?)"];
  const params     = ['click', page, page + '?%'];

  if (from)   { conditions.push('created_at >= ?'); params.push(from); }
  if (to)     { conditions.push('created_at <= ?'); params.push(to); }
  if (device) { conditions.push('device_type = ?'); params.push(device); }

  // Group into ~10px buckets to reduce payload while preserving hotspot shape
  const clicks = db.prepare(`
    SELECT
      ROUND(x / 10.0) * 10            AS x,
      ROUND(y / 10.0) * 10            AS y,
      AVG(viewport_width)             AS viewport_width,
      AVG(viewport_height)            AS viewport_height,
      COUNT(*)                        AS count
    FROM events
    WHERE ${conditions.join(' AND ')}
    GROUP BY ROUND(x/10)*10, ROUND(y/10)*10
    ORDER BY count DESC
    LIMIT 2000
  `).all(...params);

  const topElements = db.prepare(`
    SELECT element, COUNT(*) as count
    FROM events
    WHERE ${conditions.join(' AND ')} AND element IS NOT NULL
    GROUP BY element
    ORDER BY count DESC
    LIMIT 20
  `).all('click', page, page + '?%');

  res.json({
    page,
    clicks,
    top_elements: topElements,
    total: clicks.reduce((s, c) => s + c.count, 0),
  });
});

module.exports = router;
