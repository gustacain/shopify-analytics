import React, { useState, useCallback } from 'react';
import { api } from '../api';

const CACHE_TTL = 60 * 60 * 1000; // 1h

function cacheKey(pageUrl) {
  return `ai_analysis_${pageUrl}`;
}

function loadCache(pageUrl) {
  try {
    const raw = localStorage.getItem(cacheKey(pageUrl));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(cacheKey(pageUrl)); return null; }
    return data;
  } catch { return null; }
}

function saveCache(pageUrl, data) {
  try { localStorage.setItem(cacheKey(pageUrl), JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ── Score Circle ──────────────────────────────────────────────────────────────
function ScoreCircle({ score }) {
  const color  = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label  = score >= 75 ? 'Bom' : score >= 50 ? 'Médio' : 'Crítico';
  const r = 38; const c = 2 * Math.PI * r;
  const dash = ((score / 100) * c).toFixed(1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={50} y={46} textAnchor="middle" fill={color} fontSize={22} fontWeight={800}>{score}</text>
        <text x={50} y={62} textAnchor="middle" fill="#64748b" fontSize={11}>{label}</text>
      </svg>
      <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Score de Otimização
      </span>
    </div>
  );
}

// ── Priority Badge ────────────────────────────────────────────────────────────
function PriorityBadge({ p }) {
  const map = {
    alta:  { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  color: '#f87171',  label: '🔴 Alta'  },
    media: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#fbbf24',  label: '🟡 Média' },
    baixa: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#60a5fa',  label: '🔵 Baixa' },
  };
  const s = map[p] || map.baixa;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      marginBottom: 12, marginTop: 28, borderBottom: '1px solid #1e293b', paddingBottom: 6 }}>
      {children}
    </div>
  );
}

// ── Problem Card ──────────────────────────────────────────────────────────────
function ProblemCard({ p }) {
  const posLabel = { acima_dobramento: 'Acima do dobramento', meio: 'Meio da página', rodape: 'Rodapé' };
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
      padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <PriorityBadge p={p.prioridade} />
        <span style={{ fontSize: 12, color: '#7dd3fc', fontFamily: 'monospace',
          background: '#1e293b', padding: '1px 8px', borderRadius: 4 }}>
          {p.elemento}
        </span>
        {p.posicao && (
          <span style={{ fontSize: 11, color: '#475569' }}>
            • {posLabel[p.posicao] || p.posicao}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#e2e8f0', margin: '0 0 8px', lineHeight: 1.5 }}>
        {p.problema}
      </p>
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 6, padding: '8px 12px', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>💡 Sugestão: </span>
        <span style={{ fontSize: 12, color: '#cbd5e1' }}>{p.sugestao}</span>
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>
        📈 Impacto estimado: <b style={{ color: '#a3e635' }}>{p.impacto}</b>
      </span>
    </div>
  );
}

// ── Opportunity Card ──────────────────────────────────────────────────────────
function OpportunityCard({ o }) {
  return (
    <div style={{ background: '#0f172a', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10,
      padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>
        {o.titulo}
        {o.impacto_estimado && (
          <span style={{ marginLeft: 10, fontSize: 11, color: '#a3e635',
            background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.2)',
            borderRadius: 99, padding: '1px 8px', fontWeight: 600 }}>
            {o.impacto_estimado}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.5 }}>
        {o.descricao}
      </p>
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>⚙️ Como implementar: </span>
        <span style={{ fontSize: 12, color: '#cbd5e1' }}>{o.implementacao}</span>
      </div>
    </div>
  );
}

// ── Tag List ──────────────────────────────────────────────────────────────────
function TagList({ items, color }) {
  if (!items?.length) return <span style={{ fontSize: 13, color: '#475569' }}>Nenhum dado.</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {items.map((it, i) => (
        <span key={i} style={{ fontSize: 12, background: `${color}18`,
          border: `1px solid ${color}44`, color, borderRadius: 6, padding: '4px 10px' }}>
          {it}
        </span>
      ))}
    </div>
  );
}

// ── Next Steps ────────────────────────────────────────────────────────────────
function NextSteps({ steps }) {
  if (!steps?.length) return null;
  return (
    <ol style={{ margin: 0, padding: '0 0 0 20px' }}>
      {steps.map((s, i) => (
        <li key={i} style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }}>
          {s}
        </li>
      ))}
    </ol>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAnalysis({ pageUrl, heatmapData, screenshotUrl, filters }) {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(() => pageUrl ? loadCache(pageUrl) : null);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState(true);

  const analyze = useCallback(async (forceRefresh = false) => {
    if (!pageUrl || !heatmapData) return;
    if (!forceRefresh) {
      const cached = loadCache(pageUrl);
      if (cached) { setResult(cached); setExpanded(true); return; }
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        page_url:      pageUrl,
        top_elements:  heatmapData.top_elements || [],
        total_clicks:  heatmapData.total        || 0,
        clusters:      heatmapData.clicks?.length || 0,
        sessions:      heatmapData.sessions      || 0,
        screenshot_url: screenshotUrl || undefined,
      };
      const res = await api.aiAnalyze(body);
      saveCache(pageUrl, res.analysis);
      setResult(res.analysis);
      setExpanded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [pageUrl, heatmapData, screenshotUrl]);

  if (!heatmapData) return null;

  const hasResult = !!result;
  const problems  = result?.problemas || [];
  const alta      = problems.filter(p => p.prioridade === 'alta');
  const media     = problems.filter(p => p.prioridade === 'media');
  const baixa     = problems.filter(p => p.prioridade === 'baixa');

  return (
    <div style={{ marginTop: 24 }}>
      {/* Trigger button */}
      {!hasResult && !loading && (
        <button onClick={() => analyze(false)} style={btnPrimary}>
          🤖 Analisar com IA
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8',
          fontSize: 13, padding: '12px 0' }}>
          <Spinner />
          Analisando comportamento dos usuários…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: '#f87171', fontSize: 13, background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
          {error}
          <button onClick={() => analyze(true)} style={{ ...btnSecondary, marginLeft: 12, fontSize: 12 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Results panel */}
      {hasResult && !loading && (
        <div style={{ background: '#0c1424', border: '1px solid #1e293b', borderRadius: 12,
          padding: 20, marginTop: 8 }}>

          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: expanded ? 16 : 0, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                🤖 Análise de IA
              </span>
              {alta.length > 0 && (
                <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
                  borderRadius: 99, padding: '1px 8px', fontWeight: 700 }}>
                  {alta.length} problema{alta.length > 1 ? 's' : ''} crítico{alta.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => analyze(true)} style={btnSecondary} title="Reanalisar">
                🔄 Reanalisar
              </button>
              <button onClick={() => setExpanded(v => !v)} style={btnSecondary}>
                {expanded ? '▲ Recolher' : '▼ Expandir'}
              </button>
            </div>
          </div>

          {expanded && (
            <>
              {/* Score + resumo */}
              <div style={{ display: 'flex', gap: 24, alignItems: 'center',
                background: '#0f172a', borderRadius: 10, padding: '16px 20px',
                marginBottom: 4, flexWrap: 'wrap' }}>
                <ScoreCircle score={result.score ?? 0} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: 6 }}>Diagnóstico Geral</div>
                  <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {result.resumo}
                  </p>
                </div>
              </div>

              {/* Problems */}
              {problems.length > 0 && (
                <>
                  <SectionHeader>🚨 Problemas por Prioridade</SectionHeader>
                  {alta.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#f87171', marginBottom: 6, fontWeight: 600 }}>
                        PRIORIDADE ALTA
                      </div>
                      {alta.map((p, i) => <ProblemCard key={i} p={p} />)}
                    </div>
                  )}
                  {media.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6, fontWeight: 600 }}>
                        PRIORIDADE MÉDIA
                      </div>
                      {media.map((p, i) => <ProblemCard key={i} p={p} />)}
                    </div>
                  )}
                  {baixa.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 6, fontWeight: 600 }}>
                        PRIORIDADE BAIXA
                      </div>
                      {baixa.map((p, i) => <ProblemCard key={i} p={p} />)}
                    </div>
                  )}
                </>
              )}

              {/* Opportunities */}
              {result.oportunidades?.length > 0 && (
                <>
                  <SectionHeader>💡 Oportunidades de Crescimento</SectionHeader>
                  {result.oportunidades.map((o, i) => <OpportunityCard key={i} o={o} />)}
                </>
              )}

              {/* Hot / Cold elements */}
              {result.elementos_quentes?.length > 0 && (
                <>
                  <SectionHeader>🔥 Elementos Quentes</SectionHeader>
                  <TagList items={result.elementos_quentes} color="#f97316" />
                </>
              )}
              {result.elementos_ignorados?.length > 0 && (
                <>
                  <SectionHeader>👻 Elementos Ignorados</SectionHeader>
                  <TagList items={result.elementos_ignorados} color="#64748b" />
                </>
              )}

              {/* Next steps */}
              {result.proximos_passos?.length > 0 && (
                <>
                  <SectionHeader>✅ Próximos Passos</SectionHeader>
                  <NextSteps steps={result.proximos_passos} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid #334155', borderTopColor: '#6366f1',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

const btnPrimary = {
  padding: '9px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  border: 'none', borderRadius: 8, color: '#fff',
  cursor: 'pointer', fontWeight: 700, fontSize: 14,
  boxShadow: '0 0 20px rgba(99,102,241,0.3)',
  transition: 'opacity 0.15s',
};

const btnSecondary = {
  padding: '6px 14px', background: 'transparent',
  border: '1px solid #334155', borderRadius: 6, color: '#94a3b8',
  cursor: 'pointer', fontSize: 13,
};
