const express = require('express');
const router  = express.Router();
const db      = require('../db');

const STAGES = [
  { key: 'landing',  label: 'Visita',            pattern: '%',           icon: '🏠' },
  { key: 'product',  label: 'Produto visto',      pattern: '%/products/%',icon: '📦' },
  { key: 'cart',     label: 'Carrinho',           pattern: '%/cart%',     icon: '🛒' },
  { key: 'checkout', label: 'Checkout iniciado',  pattern: '%/checkout%', icon: '💳' },
  { key: 'purchase', label: 'Compra concluída',   pattern: '%/orders/%',  icon: '✅' },
];

router.get('/', (req, res) => {
  const { from, to, device } = req.query;

  const extraConds  = [];
  const extraParams = [];

  if (from)   { extraConds.push('created_at >= ?'); extraParams.push(from); }
  if (to)     { extraConds.push('created_at <= ?'); extraParams.push(to); }
  if (device) { extraConds.push('device_type = ?'); extraParams.push(device); }

  const extra = extraConds.length ? ' AND ' + extraConds.join(' AND ') : '';

  const funnel = STAGES.map(stage => {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT session_id) AS sessions
      FROM events
      WHERE page_url LIKE ? ${extra}
    `).get(stage.pattern, ...extraParams);

    return { ...stage, sessions: row.sessions };
  });

  // Compute conversion and drop-off relative to previous stage
  const result = funnel.map((stage, i) => {
    const prevSessions = i === 0 ? stage.sessions : funnel[i - 1].sessions;
    const conversion   = prevSessions > 0 ? Math.round((stage.sessions / prevSessions) * 100) : 0;
    const overallConv  = funnel[0].sessions > 0
      ? Math.round((stage.sessions / funnel[0].sessions) * 100) : 0;

    return {
      ...stage,
      conversion_from_prev: conversion,
      dropoff_from_prev:    100 - conversion,
      overall_conversion:   overallConv,
    };
  });

  res.json({ funnel: result });
});

module.exports = router;
