import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';

const DEVICE_ICON = { desktop: '🖥️', mobile: '📱', tablet: '📟' };

function timeSince(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr.replace(' ', 'T') + 'Z');
  const m = Math.floor(diff / 60000);
  if (m < 2)   return 'agora';
  if (m < 60)  return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function pageLabel(url, catalog) {
  if (!url) return '';
  const m = url.match(/^\/products\/([^?#/]+)/);
  if (m) {
    const product = catalog.products?.find(p => p.handle === m[1]);
    if (product) return product.title;
  }
  const cm = url.match(/^\/pages\/([^?#/]+)/);
  if (cm) {
    const page = catalog.pages?.find(p => p.handle === cm[1]);
    if (page) return page.title;
  }
  const labels = {
    '/':         'Página inicial',
    '/cart':     'Carrinho',
    '/checkout': 'Checkout',
    '/search':   'Busca',
    '/collections/all': 'Todas as coleções',
  };
  return labels[url] || '';
}

export default function PageList({ onSelectPage, filters }) {
  const [pages,   setPages]   = useState([]);
  const [catalog, setCatalog] = useState({ products: [], pages: [] });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState('sessions'); // sessions | clicks | last_seen
  const [error,   setError]   = useState('');

  const domain = localStorage.getItem('sa_store_url')      || '';
  const token  = localStorage.getItem('sa_shopify_token')  || '';

  // Fetch analytics pages
  useEffect(() => {
    setLoading(true);
    api.getPages(filters)
      .then(r => setPages(r.pages || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  // Enrich with Shopify catalog (non-blocking)
  useEffect(() => {
    if (!domain || !token) return;
    Promise.all([
      api.shopifyProducts(domain, token).catch(() => ({ products: [] })),
      api.shopifyPages(domain, token).catch(() => ({ pages: [] })),
    ]).then(([prod, pg]) => {
      setCatalog({ products: prod.products || [], pages: pg.pages || [] });
    });
  }, [domain, token]);

  const filtered = useMemo(() => {
    let list = pages.filter(p =>
      !search || p.page_url.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      if (sort === 'last_seen') return new Date(b.last_seen) - new Date(a.last_seen);
      return (b[sort] || 0) - (a[sort] || 0);
    });
    return list;
  }, [pages, search, sort]);

  const totalSessions = pages.reduce((s, p) => s + p.sessions, 0);
  const totalClicks   = pages.reduce((s, p) => s + p.clicks, 0);

  if (loading) return <Placeholder>Carregando páginas…</Placeholder>;
  if (error)   return <Placeholder style={{ color: '#f87171' }}>Erro: {error}</Placeholder>;
  if (!pages.length) return (
    <Placeholder>
      Nenhum dado ainda. Instale o snippet e aguarde as primeiras visitas.
    </Placeholder>
  );

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['Páginas rastreadas', pages.length, '#3b82f6'],
          ['Total de sessões',   totalSessions.toLocaleString(), '#6366f1'],
          ['Total de cliques',   totalClicks.toLocaleString(),   '#f97316'],
        ].map(([label, value, color]) => (
          <div key={label} style={{
            flex: '1 1 160px', background: '#1e293b', borderRadius: 10,
            padding: '14px 18px', border: `1px solid ${color}30`,
          }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
          </div>
        ))}
        {!token && (
          <div style={{
            flex: '1 1 260px', background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '14px 18px',
            fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚙️ Configure o Admin API token para ver nomes dos produtos.
          </div>
        )}
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por URL…"
          style={{
            flex: 1, padding: '8px 12px', background: '#0f172a',
            border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13,
          }}
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{
            padding: '8px 12px', background: '#0f172a', border: '1px solid #334155',
            borderRadius: 6, color: '#e2e8f0', fontSize: 13,
          }}
        >
          <option value="sessions">Ordenar por sessões</option>
          <option value="clicks">Ordenar por cliques</option>
          <option value="last_seen">Ordenar por recente</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Página', 'Sessões', 'Cliques', 'Views', 'Último acesso', 'Device', ''].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: h === '' ? 'right' : 'left',
                  color: '#475569', fontWeight: 600, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const label  = pageLabel(p.page_url, catalog);
              const maxSes = filtered[0]?.sessions || 1;
              const barW   = Math.round((p.sessions / maxSes) * 100);

              return (
                <tr
                  key={p.page_url}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  {/* Page URL + label */}
                  <td style={{ padding: '11px 12px', maxWidth: 340 }}>
                    <div style={{ position: 'relative', paddingBottom: 3 }}>
                      {label && (
                        <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 2, fontSize: 13 }}>
                          {label}
                        </div>
                      )}
                      <code style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>
                        {p.page_url.length > 60 ? p.page_url.slice(0, 60) + '…' : p.page_url}
                      </code>
                    </div>
                    {/* Session bar */}
                    <div style={{ marginTop: 5, height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: '#3b82f6', borderRadius: 2 }} />
                    </div>
                  </td>

                  <td style={{ padding: '11px 12px', fontWeight: 700, color: '#6366f1' }}>
                    {p.sessions.toLocaleString()}
                  </td>

                  <td style={{ padding: '11px 12px', color: p.clicks > 0 ? '#f97316' : '#475569' }}>
                    {p.clicks.toLocaleString()}
                  </td>

                  <td style={{ padding: '11px 12px', color: '#94a3b8' }}>
                    {p.page_views.toLocaleString()}
                  </td>

                  <td style={{ padding: '11px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {timeSince(p.last_seen)}
                  </td>

                  <td style={{ padding: '11px 12px', color: '#64748b', fontSize: 12 }}>
                    {DEVICE_ICON[p.top_device] || '💻'}
                  </td>

                  <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectPage(p.page_url)}
                      disabled={p.clicks === 0}
                      style={{
                        padding: '5px 12px',
                        background: p.clicks > 0 ? '#1e3a5f' : '#1a2332',
                        border: `1px solid ${p.clicks > 0 ? '#3b82f6' : '#2d3748'}`,
                        borderRadius: 5, color: p.clicks > 0 ? '#7dd3fc' : '#4a5568',
                        cursor: p.clicks > 0 ? 'pointer' : 'not-allowed',
                        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                      }}
                      title={p.clicks === 0 ? 'Nenhum clique registrado ainda' : 'Ver mapa de calor'}
                    >
                      🔥 Heatmap
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, color: '#475569', fontSize: 12 }}>
        {filtered.length} de {pages.length} páginas
        {search && ` para "${search}"`}
      </div>
    </div>
  );
}

function Placeholder({ children, style }) {
  return (
    <div style={{
      height: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#475569', fontSize: 14, ...style,
    }}>
      {children}
    </div>
  );
}
