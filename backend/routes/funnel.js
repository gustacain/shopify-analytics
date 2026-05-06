const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Each stage uses a WHERE condition instead of a URL pattern.
// Dedicated event_type values are preferred; page_url LIKE provides
// backward-compat for data collected before the snippet update.
const STAGES = [
  {
    key:   'landing',
    label: 'Visita',
    icon:  '🏠',
    where: "event_type = 'page_view'",
  },
  {
    key:   'product',
    label: 'Produto visto',
    icon:  '📦',
    where: "event_type = 'page_view' AND page_url LIKE '%/products/%'",
  },
  {
    key:   'cart',
    label: 'Carrinho',
    icon:  '🛒',
    // add_to_cart = clique no botão (AJAX ou form) — capturado pelo snippet
    // fallback: visita direta a /cart
    where: "event_type = 'add_to_cart' OR (event_type = 'page_view' AND page_url LIKE '%/cart%')",
  },
  {
    key:   'checkout',
    label: 'Checkout iniciado',
    icon:  '💳',
    // checkout_start = clique em link/form de checkout — capturado pelo snippet
    // fallback: page_view em /checkout (Shopify Plus ou tema headless no mesmo domínio)
    where: "event_type = 'checkout_start' OR (event_type = 'page_view' AND page_url LIKE '%/checkout%')",
  },
  {
    key:   'purchase',
    label: 'Compra concluída',
    icon:  '✅',
    // purchase = emitido pelo analytics-purchase.liquid na thank-you page
    // fallback: page_view em /orders/ (usuário logado recarrega a página)
    where: "event_type = 'purchase' OR (event_type = 'page_view' AND page_url LIKE '%/orders/%')",
  },
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
      WHERE (${stage.where}) ${extra}
    `).get(...extraParams);

    return { ...stage, sessions: row.sessions };
  });

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
