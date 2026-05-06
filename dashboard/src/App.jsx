import React, { useState, useEffect, useCallback } from 'react';
import Filters     from './components/Filters';
import Heatmap     from './components/Heatmap';
import ScrollDepth from './components/ScrollDepth';
import Funnel      from './components/Funnel';
import Sessions    from './components/Sessions';
import PageList    from './components/PageList';
import Settings    from './components/Settings';
import { api }    from './api';

const TABS = [
  { id: 'overview',  label: '📊 Visão Geral' },
  { id: 'pages',     label: '📄 Páginas' },
  { id: 'heatmap',   label: '🔥 Mapa de Calor' },
  { id: 'scroll',    label: '📜 Scroll Depth' },
  { id: 'sessions',  label: '👤 Sessões' },
  { id: 'n8n',       label: '🔗 n8n / Webhooks' },
  { id: 'settings',  label: '⚙️ Configuração' },
];

function StatCard({ label, value, sub, color = '#3b82f6' }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '18px 20px',
      border: `1px solid ${color}30`, flex: '1 1 160px',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 12, padding: 24,
      border: '1px solid #334155', marginBottom: 24,
    }}>
      {title && <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{title}</h2>}
      {children}
    </div>
  );
}

export default function App() {
  const [tab, setTab]           = useState('overview');
  const [filters, setFilters]   = useState({});
  const [applied, setApplied]   = useState({});
  const [stats, setStats]       = useState(null);
  const [apiOk, setApiOk]       = useState(null);

  // Shared selected page — set from PageList, consumed by Heatmap
  const [selectedPage, setSelectedPage] = useState(null);

  // n8n config state
  const [n8nUrl, setN8nUrl]         = useState('');
  const [threshold, setThreshold]   = useState('70');
  const [configSaved, setConfigSaved] = useState(false);
  const [n8nLoading, setN8nLoading] = useState(false);

  useEffect(() => {
    api.health().then(() => setApiOk(true)).catch(() => setApiOk(false));
    api.getWebhookConfig().then(c => {
      if (c.n8n_url)        setN8nUrl(c.n8n_url);
      if (c.cart_threshold) setThreshold(String(Math.round(c.cart_threshold * 100)));
    }).catch(() => {});
  }, []);

  useEffect(() => { loadStats(applied); }, [JSON.stringify(applied)]);

  async function loadStats(f) {
    try {
      const [funnel, sessions] = await Promise.all([
        api.getFunnel(f),
        api.getSessions({ ...f, limit: 1 }),
      ]);
      const stages   = funnel.funnel || [];
      const landing  = stages[0]?.sessions ?? 0;
      const purchase = stages[4]?.sessions ?? 0;
      const cart     = stages[2]?.sessions ?? 0;
      const checkout = stages[3]?.sessions ?? 0;
      const abandon  = cart > 0 ? Math.round(((cart - checkout) / cart) * 100) : 0;
      const conv     = landing > 0 ? ((purchase / landing) * 100).toFixed(1) : '0.0';
      setStats({
        sessions:       sessions.total,
        pageViews:      landing,
        conversion:     `${conv}%`,
        abandon:        `${abandon}%`,
        abandon_color:  abandon >= 70 ? '#ef4444' : abandon >= 50 ? '#f97316' : '#22c55e',
      });
    } catch {}
  }

  // Navigate from PageList → Heatmap tab with the page pre-selected
  const handleSelectPage = useCallback((pageUrl) => {
    setSelectedPage(pageUrl);
    setTab('heatmap');
  }, []);

  const apply = () => setApplied({ ...filters });

  const saveN8n = async () => {
    setN8nLoading(true);
    try {
      await api.saveWebhookConfig({ n8n_url: n8nUrl, cart_threshold: parseFloat(threshold) / 100 });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } finally {
      setN8nLoading(false);
    }
  };

  const showFilters = !['settings', 'pages', 'n8n'].includes(tab);
  const showPage    = tab === 'heatmap' || tab === 'scroll';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#0c1424', borderRight: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Shopify</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 1 }}>Analytics</div>
          {localStorage.getItem('sa_store_url') && (
            <div style={{
              marginTop: 8, fontSize: 11, color: '#3b82f6',
              background: 'rgba(59,130,246,0.1)', borderRadius: 4, padding: '3px 7px',
              display: 'inline-block', maxWidth: '100%', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {localStorage.getItem('sa_store_url')}
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '10px 0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 20px', background: tab === t.id ? '#1e293b' : 'transparent',
              border: 'none', borderLeft: `3px solid ${tab === t.id ? '#3b82f6' : 'transparent'}`,
              color: tab === t.id ? '#e2e8f0' : '#64748b',
              cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: apiOk === null ? '#64748b' : apiOk ? '#22c55e' : '#ef4444',
            }} />
            <span style={{ color: '#64748b' }}>
              {apiOk === null ? 'Verificando…' : apiOk ? 'API online' : 'API offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {TABS.find(t => t.id === tab)?.label}
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          {tab === 'settings'
            ? 'Credenciais e integração com a loja Shopify'
            : tab === 'pages'
            ? 'Todas as páginas com dados coletados — clique em Heatmap para visualizar'
            : 'Dados comportamentais da sua loja Shopify'}
        </p>

        {showFilters && (
          <Filters value={filters} onChange={setFilters} onApply={apply} showPage={showPage} />
        )}

        {/* ── OVERVIEW ────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
              <StatCard label="Sessões"          value={stats?.sessions?.toLocaleString()} color="#3b82f6" />
              <StatCard label="Visitas (landing)" value={stats?.pageViews?.toLocaleString()} color="#6366f1" />
              <StatCard label="Conversão geral"  value={stats?.conversion}                color="#22c55e" />
              <StatCard
                label="Abandono carrinho"
                value={stats?.abandon}
                color={stats?.abandon_color || '#f97316'}
                sub={stats?.abandon_color === '#ef4444' ? '⚠️ Acima de 70%' : undefined}
              />
            </div>
            <Card title="Funil de Conversão"><Funnel filters={applied} /></Card>
            <Card title="Scroll Depth"><ScrollDepth filters={applied} /></Card>
          </>
        )}

        {/* ── PÁGINAS ─────────────────────────────────────────────── */}
        {tab === 'pages' && (
          <Card title="">
            <PageList onSelectPage={handleSelectPage} filters={applied} />
          </Card>
        )}

        {/* ── HEATMAP ─────────────────────────────────────────────── */}
        {tab === 'heatmap' && (
          <Card title="Mapa de Calor de Cliques">
            <Heatmap filters={applied} selectedPage={selectedPage} onPageConsumed={() => setSelectedPage(null)} />
          </Card>
        )}

        {/* ── SCROLL ──────────────────────────────────────────────── */}
        {tab === 'scroll' && (
          <Card title="Profundidade de Scroll"><ScrollDepth filters={applied} /></Card>
        )}

        {/* ── SESSIONS ────────────────────────────────────────────── */}
        {tab === 'sessions' && (
          <Card title="Sessões Gravadas"><Sessions filters={applied} /></Card>
        )}

        {/* ── N8N ─────────────────────────────────────────────────── */}
        {tab === 'n8n' && (
          <Card title="Integração com n8n">
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Configure o webhook n8n para alertas automáticos de abandono e resumos diários.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 540 }}>
              <div>
                <label style={ls}>URL do Webhook n8n</label>
                <input value={n8nUrl} onChange={e => setN8nUrl(e.target.value)}
                  placeholder="https://seu-n8n.com/webhook/shopify-analytics"
                  style={is} />
              </div>
              <div>
                <label style={ls}>Threshold de abandono (%)</label>
                <input type="number" min={1} max={100} value={threshold}
                  onChange={e => setThreshold(e.target.value)} style={{ ...is, width: 120 }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveN8n} disabled={n8nLoading} style={pb}>
                  {n8nLoading ? 'Salvando…' : 'Salvar configuração'}
                </button>
                <button onClick={() => api.triggerDailySummary().then(() => alert('Resumo enviado!')).catch(e => alert('Erro: ' + e.message))}
                  disabled={!n8nUrl} style={{ ...sb, opacity: n8nUrl ? 1 : 0.4, cursor: n8nUrl ? 'pointer' : 'not-allowed' }}>
                  Enviar resumo diário
                </button>
              </div>
              {configSaved && (
                <div style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
                  Configuração salva!
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── SETTINGS ────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <Card title="Configuração da Loja">
            <Settings onSave={() => {}} />
          </Card>
        )}
      </main>
    </div>
  );
}

const ls = { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6, fontWeight: 500 };
const is = { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 14 };
const pb = { padding: '9px 20px', background: '#3b82f6', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const sb = { padding: '9px 20px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 14 };
