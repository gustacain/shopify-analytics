require('./db'); // initialize DB on startup
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3001;

// Analytics collection endpoint — must accept requests from any Shopify store origin.
// credentials:true is intentionally omitted; wildcard origin + no credentials is correct
// for a public event ingestion API. sendBeacon sends Content-Type: text/plain so we
// must allow that header too.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
// sendBeacon sends text/plain to avoid CORS preflight; parse it as JSON here.
app.use(express.text({ type: 'text/plain', limit: '2mb' }));

app.use('/api/events',      require('./routes/events'));
app.use('/api/heatmap',     require('./routes/heatmap'));
app.use('/api/sessions',    require('./routes/sessions'));
app.use('/api/funnel',      require('./routes/funnel'));
app.use('/api/scroll-depth',require('./routes/scrollDepth'));
app.use('/api/pages',       require('./routes/pages'));
app.use('/api/shopify',     require('./routes/shopify'));
app.use('/api/screenshot',  require('./routes/screenshot'));
app.use('/api/webhook',     require('./routes/webhook'));
app.use('/api/ai-analyze',  require('./routes/ai-analyze'));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Diagnóstico: contagem de eventos por tipo nos últimos 7 dias
app.get('/api/debug/event-types', (_req, res) => {
  const db = require('./db');
  const rows = db.prepare(`
    SELECT event_type, COUNT(*) AS total, COUNT(DISTINCT session_id) AS sessions,
           MAX(created_at) AS last_seen
    FROM events
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY event_type
    ORDER BY total DESC
  `).all();
  res.json({ window: '7d', event_types: rows });
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log('\n  Shopify Analytics API');
  console.log(`  API  -> http://localhost:${PORT}`);
  console.log(`  UI   -> http://localhost:5173\n`);
});
