const express   = require('express');
const router    = express.Router();
const db        = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é um especialista em CRO (Conversion Rate Optimization) para e-commerce Shopify com 10 anos de experiência. Analise os dados de comportamento do usuário e forneça sugestões específicas, acionáveis e baseadas em dados para aumentar a taxa de conversão.

Ao analisar, compare cada métrica com os benchmarks do setor de e-commerce:
- Taxa de conversão: benchmark 2–4% (ruim <1%, médio 1–3%, bom >3%)
- Tempo médio na página: benchmark >2min (ruim <60s, médio 60–120s, bom >120s)
- Taxa de rejeição: benchmark <60% (bom <40%, médio 40–60%, ruim >60%)
- Add to cart rate: benchmark 8–15% (ruim <5%, médio 5–15%, bom >15%)
- Abandono de checkout: benchmark <70% (bom <50%, médio 50–70%, ruim >70%)

Quando a métrica estiver abaixo do benchmark, priorize problemas relacionados a ela. Cite os números reais da página nas suas sugestões. Seja específico sobre elementos Shopify (sections, liquid, apps, metafields) quando sugerir implementações.

Responda APENAS com um objeto JSON válido, sem markdown, sem texto adicional:
{
  "score": <0-100>,
  "resumo": "<diagnóstico em 2-3 frases citando as métricas mais críticas>",
  "problemas": [
    {
      "prioridade": "<alta|media|baixa>",
      "elemento": "<nome do elemento>",
      "problema": "<descrição clara, citando a métrica se relevante>",
      "impacto": "<impacto estimado na conversão>",
      "sugestao": "<sugestão específica e acionável>",
      "posicao": "<acima_dobramento|meio|rodape>"
    }
  ],
  "oportunidades": [
    {
      "titulo": "<nome da oportunidade>",
      "descricao": "<descrição detalhada>",
      "implementacao": "<como implementar no Shopify>",
      "impacto_estimado": "<ex: +5-15% conversão>"
    }
  ],
  "elementos_ignorados": ["<elemento importante com poucos cliques>"],
  "elementos_quentes": ["<elemento com muitos cliques aproveitável>"],
  "proximos_passos": ["<ação imediata priorizada>"]
}`;

// ── DB helpers ────────────────────────────────────────────────────────────────

function fetchPageMetrics(page_url) {
  const p     = page_url;
  const pLike = page_url + '?%';

  const totalSessions = db.prepare(
    `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url = ? OR page_url LIKE ?`
  ).get(p, pLike).c;

  // Conversão: sessões que visitaram a página E tiveram purchase na sessão
  const purchaseSessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM events
    WHERE (page_url = ? OR page_url LIKE ?)
    AND session_id IN (SELECT DISTINCT session_id FROM events WHERE event_type = 'purchase')
  `).get(p, pLike).c;

  const conversionRate = totalSessions > 0
    ? Math.round((purchaseSessions / totalSessions) * 1000) / 10
    : 0;

  // Média de conversão do site inteiro
  const totalSiteSessions = db.prepare(
    `SELECT COUNT(DISTINCT session_id) AS c FROM events`
  ).get().c;
  const sitePurchases = db.prepare(
    `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE event_type = 'purchase'`
  ).get().c;
  const avgConversionSite = totalSiteSessions > 0
    ? Math.round((sitePurchases / totalSiteSessions) * 1000) / 10
    : 0;

  // Tempo médio na página (time_on_page é em ms no snippet)
  const timeRow = db.prepare(`
    SELECT AVG(time_on_page) AS avg_ms FROM events
    WHERE event_type = 'page_exit' AND time_on_page > 0
    AND (page_url = ? OR page_url LIKE ?)
  `).get(p, pLike);
  const avgTimeOnPageS = timeRow?.avg_ms ? Math.round(timeRow.avg_ms / 1000) : null;

  // Taxa de rejeição: sessões sem nenhum clique na página
  const bounceSessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM events e1
    WHERE (e1.page_url = ? OR e1.page_url LIKE ?)
    AND NOT EXISTS (
      SELECT 1 FROM events e2
      WHERE e2.session_id = e1.session_id
      AND e2.event_type = 'click'
      AND (e2.page_url = ? OR e2.page_url LIKE ?)
    )
  `).get(p, pLike, p, pLike).c;
  const bounceRate = totalSessions > 0
    ? Math.round((bounceSessions / totalSessions) * 100)
    : null;

  // Add to cart rate: sessões que visitaram a página e tiveram add_to_cart
  const addToCartSessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM events
    WHERE (page_url = ? OR page_url LIKE ?)
    AND session_id IN (SELECT DISTINCT session_id FROM events WHERE event_type = 'add_to_cart')
  `).get(p, pLike).c;
  const addToCartRate = totalSessions > 0
    ? Math.round((addToCartSessions / totalSessions) * 100)
    : null;

  // Abandono de checkout (global da loja)
  const checkoutSessions = db.prepare(
    `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE event_type = 'checkout_start'`
  ).get().c;
  const checkoutNoPurchase = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM events
    WHERE event_type = 'checkout_start'
    AND session_id NOT IN (SELECT DISTINCT session_id FROM events WHERE event_type = 'purchase')
  `).get().c;
  const checkoutAbandonRate = checkoutSessions > 0
    ? Math.round((checkoutNoPurchase / checkoutSessions) * 100)
    : null;

  // Fontes de tráfego via metadata JSON
  let trafficSources = [];
  try {
    trafficSources = db.prepare(`
      SELECT
        COALESCE(
          NULLIF(JSON_EXTRACT(metadata, '$.utm_source'), ''),
          NULLIF(JSON_EXTRACT(metadata, '$.referrer'), ''),
          'direto'
        ) AS source,
        COUNT(DISTINCT session_id) AS sessions
      FROM events
      WHERE event_type = 'page_view' AND (page_url = ? OR page_url LIKE ?)
      GROUP BY source ORDER BY sessions DESC LIMIT 5
    `).all(p, pLike);
  } catch {}

  return {
    total_sessions:        totalSessions,
    conversion_rate:       conversionRate,
    avg_conversion_site:   avgConversionSite,
    avg_time_on_page_s:    avgTimeOnPageS,
    bounce_rate:           bounceRate,
    add_to_cart_rate:      addToCartRate,
    checkout_abandon_rate: checkoutAbandonRate,
    traffic_sources:       trafficSources,
  };
}

function fetchScrollData(page_url) {
  const p     = page_url;
  const pLike = page_url + '?%';
  const total = db.prepare(
    `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url = ? OR page_url LIKE ?`
  ).get(p, pLike).c;

  return [25, 50, 75, 100].map(threshold => {
    const s = db.prepare(`
      SELECT COUNT(DISTINCT session_id) AS c FROM events
      WHERE event_type = 'scroll' AND scroll_percent >= ?
      AND (page_url = ? OR page_url LIKE ?)
    `).get(threshold, p, pLike).c;
    return { threshold, sessions: s, pct: total > 0 ? Math.round((s / total) * 100) : 0 };
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { page_url, top_elements = [], total_clicks = 0, clusters = 0,
          sessions = 0, screenshot_url } = req.body;

  if (!page_url) return res.status(400).json({ error: 'page_url é obrigatório' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });
  }

  let metrics    = {};
  let scrollData = [];
  try { metrics    = fetchPageMetrics(page_url); } catch (e) { console.warn('[ai-analyze] metrics:', e.message); }
  try { scrollData = fetchScrollData(page_url);  } catch {}

  const fmt = (v, suffix = '') => v != null ? `${v}${suffix}` : 'N/D';

  const metricsBlock = `
**Métricas da Página (últimos dados disponíveis):**
- Sessões totais na página: ${metrics.total_sessions ?? 0}
- Taxa de conversão: ${fmt(metrics.conversion_rate, '%')} (média do site: ${fmt(metrics.avg_conversion_site, '%')}; benchmark setor: 2–4%)
- Tempo médio na página: ${metrics.avg_time_on_page_s != null ? `${metrics.avg_time_on_page_s}s` : 'N/D'} (benchmark: >120s)
- Taxa de rejeição: ${fmt(metrics.bounce_rate, '%')} (benchmark: <60%)
- Add to cart rate: ${fmt(metrics.add_to_cart_rate, '%')} (benchmark: 8–15%)
- Abandono de checkout (loja): ${fmt(metrics.checkout_abandon_rate, '%')} (benchmark: <70%)
${metrics.traffic_sources?.length ? `- Fontes de tráfego: ${metrics.traffic_sources.map(s => `${s.source} (${s.sessions} sessões)`).join(', ')}` : ''}`;

  const userContent = `Analise esta página de produto Shopify:

**URL:** ${page_url}
**Total de cliques:** ${total_clicks}
**Clusters de clique:** ${clusters}
**Sessões (heatmap):** ${sessions}
${screenshot_url ? `**Screenshot:** ${screenshot_url}` : ''}
${metricsBlock}

**Top elementos clicados:**
${top_elements.length
    ? top_elements.slice(0, 15).map((el, i) => `${i + 1}. "${el.element}" — ${el.count} cliques`).join('\n')
    : 'Nenhum elemento registrado'}

**Scroll Depth:**
${scrollData.length
    ? scrollData.map(s => `- ${s.threshold}%: ${s.pct}% dos usuários chegaram (${s.sessions} sessões)`).join('\n')
    : 'Dados de scroll não disponíveis'}

Compare as métricas com os benchmarks do setor, identifique os maiores gargalos e forneça sugestões priorizadas pelo impacto na conversão.`;

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userContent }],
    });

    const text = message.content[0]?.text || '';
    let analysis;
    try {
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      analysis = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'Resposta inválida da IA', raw: text.slice(0, 500) });
    }

    res.json({ ok: true, page_url, metrics, analysis });
  } catch (e) {
    console.error('[ai-analyze]', e.message);
    res.status(502).json({ error: 'Falha ao chamar Anthropic API: ' + e.message });
  }
});

module.exports = router;
