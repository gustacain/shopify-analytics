const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é um especialista em CRO (Conversion Rate Optimization) para e-commerce Shopify com 10 anos de experiência. Analise os dados de comportamento do usuário e forneça sugestões específicas, acionáveis e baseadas em dados para aumentar a taxa de conversão. Considere best practices de UX, psicologia do consumidor e padrões de e-commerce de alta conversão.

Responda APENAS com um objeto JSON válido, sem markdown, sem texto adicional. O JSON deve seguir exatamente esta estrutura:
{
  "score": <número 0-100 representando o score de otimização da página>,
  "resumo": "<diagnóstico geral em 2-3 frases>",
  "problemas": [
    {
      "prioridade": "<alta|media|baixa>",
      "elemento": "<nome do elemento problemático>",
      "problema": "<descrição clara do problema>",
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
  "elementos_ignorados": ["<elemento importante que recebe poucos cliques>"],
  "elementos_quentes": ["<elemento que recebe muitos cliques e pode ser melhor aproveitado>"],
  "proximos_passos": ["<ação imediata priorizada>"]
}`;

router.post('/', async (req, res) => {
  const { page_url, top_elements = [], total_clicks = 0, clusters = 0,
          sessions = 0, screenshot_url } = req.body;

  if (!page_url) return res.status(400).json({ error: 'page_url é obrigatório' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });
  }

  // Busca scroll depth do banco para a página
  let scrollData = [];
  try {
    const THRESHOLDS = [25, 50, 75, 100];
    const totalSessions = db.prepare(
      `SELECT COUNT(DISTINCT session_id) AS c FROM events WHERE page_url = ? OR page_url LIKE ?`
    ).get(page_url, page_url + '?%').c;

    scrollData = THRESHOLDS.map(threshold => {
      const s = db.prepare(`
        SELECT COUNT(DISTINCT session_id) AS c FROM events
        WHERE event_type = 'scroll' AND scroll_percent >= ?
        AND (page_url = ? OR page_url LIKE ?)
      `).get(threshold, page_url, page_url + '?%').c;
      return {
        threshold,
        sessions: s,
        pct: totalSessions > 0 ? Math.round((s / totalSessions) * 100) : 0,
      };
    });
  } catch {}

  const userContent = `Analise esta página de produto Shopify com os seguintes dados comportamentais:

**URL da página:** ${page_url}
**Total de cliques:** ${total_clicks}
**Clusters de clique:** ${clusters}
**Sessões:** ${sessions}
${screenshot_url ? `**Screenshot:** ${screenshot_url}` : ''}

**Top elementos clicados:**
${top_elements.length
  ? top_elements.slice(0, 15).map((el, i) =>
      `${i + 1}. "${el.element}" — ${el.count} cliques`
    ).join('\n')
  : 'Nenhum elemento registrado'}

**Scroll Depth:**
${scrollData.length
  ? scrollData.map(s => `- ${s.threshold}% da página: ${s.pct}% dos usuários chegaram aqui (${s.sessions} sessões)`).join('\n')
  : 'Dados de scroll não disponíveis'}

Com base nesses dados, identifique problemas de conversão, oportunidades de melhoria e forneça os próximos passos mais impactantes. Seja específico sobre elementos do Shopify (liquid, sections, apps) quando sugerir implementações.`;

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
      // Remove possível markdown code block se Claude incluir
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      analysis = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'Resposta inválida da IA', raw: text.slice(0, 500) });
    }

    res.json({ ok: true, page_url, analysis });
  } catch (e) {
    console.error('[ai-analyze]', e.message);
    res.status(502).json({ error: 'Falha ao chamar Anthropic API: ' + e.message });
  }
});

module.exports = router;
