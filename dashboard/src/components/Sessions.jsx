import React, { useEffect, useState } from 'react';
import { api } from '../api';
import SessionReplay from './SessionReplay';

const DEVICE_ICON = { desktop: '🖥️', mobile: '📱', tablet: '📟' };

function Badge({ children, color = '#334155' }) {
  return (
    <span style={{
      background: color, borderRadius: 4, padding: '2px 7px',
      fontSize: 11, fontWeight: 600, color: '#e2e8f0',
    }}>
      {children}
    </span>
  );
}

function formatDuration(secs) {
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function Sessions({ filters }) {
  const [data, setData]           = useState({ sessions: [], total: 0 });
  const [loading, setLoading]     = useState(true);
  const [offset, setOffset]       = useState(0);
  const [replayId, setReplayId]   = useState(null);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.getSessions({ ...filters, limit, offset })
      .then(setData)
      .catch(() => setData({ sessions: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters), offset]);

  if (loading) return <Placeholder>Carregando sessões…</Placeholder>;
  if (!data.sessions.length) return <Placeholder>Nenhuma sessão encontrada.</Placeholder>;

  return (
    <div>
      <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 13 }}>
        {data.total.toLocaleString()} sessões encontradas
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Device','Início','Duração','Páginas','Cliques','Scroll max','Ações'].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left',
                  color: '#64748b', fontWeight: 600, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((s, i) => {
              const duration = s.time_on_page ||
                Math.round((new Date(s.end_time) - new Date(s.start_time)) / 1000);
              const pages = [...new Set((s.pages_visited || '').split('|||').filter(Boolean))];

              return (
                <tr key={s.session_id} style={{
                  borderBottom: '1px solid #1e293b',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {DEVICE_ICON[s.device_type] || '💻'}{' '}
                    <span style={{ color: '#94a3b8' }}>{s.device_type}</span>
                    {s.screen_width && (
                      <span style={{ color: '#475569', fontSize: 11, marginLeft: 6 }}>
                        {s.screen_width}×{s.screen_height}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {new Date(s.start_time).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{formatDuration(duration)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300 }}>
                      {pages.slice(0, 3).map(p => (
                        <Badge key={p}>{p.length > 30 ? p.slice(0, 30) + '…' : p}</Badge>
                      ))}
                      {pages.length > 3 && <Badge color="#1e3a5f">+{pages.length - 3}</Badge>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {s.clicks ?? 0}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {s.max_scroll != null ? (
                      <span style={{
                        color: s.max_scroll >= 75 ? '#22c55e' : s.max_scroll >= 50 ? '#eab308' : '#f87171',
                      }}>
                        {s.max_scroll}%
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => setReplayId(s.session_id)}
                      style={{
                        padding: '5px 12px', background: '#1e3a5f',
                        border: '1px solid #3b82f6', borderRadius: 5,
                        color: '#7dd3fc', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      }}
                    >
                      ▶ Replay
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <button
          onClick={() => setOffset(Math.max(0, offset - limit))}
          disabled={offset === 0}
          style={paginationBtn(offset === 0)}
        >
          ← Anterior
        </button>
        <span style={{ color: '#64748b', fontSize: 13 }}>
          {offset + 1}–{Math.min(offset + limit, data.total)} de {data.total}
        </span>
        <button
          onClick={() => setOffset(offset + limit)}
          disabled={offset + limit >= data.total}
          style={paginationBtn(offset + limit >= data.total)}
        >
          Próximo →
        </button>
      </div>

      {replayId && (
        <SessionReplay sessionId={replayId} onClose={() => setReplayId(null)} />
      )}
    </div>
  );
}

function paginationBtn(disabled) {
  return {
    padding: '7px 16px',
    background: disabled ? '#1e293b' : '#0f172a',
    border: '1px solid #334155',
    borderRadius: 6, color: disabled ? '#475569' : '#94a3b8',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13,
  };
}

function Placeholder({ children }) {
  return (
    <div style={{
      height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#475569', fontSize: 15,
    }}>
      {children}
    </div>
  );
}
