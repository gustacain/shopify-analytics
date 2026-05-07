import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

// ── CSS ───────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('sr-css')) {
  const s = document.createElement('style');
  s.id = 'sr-css';
  s.textContent = `
    @keyframes sr-ripple {
      0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.9; }
      100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
    }
    @keyframes sr-rage {
      0%   { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(5); opacity: 0; }
    }
    .sr-session-card:hover { border-color: #334155 !important; background: #111827 !important; }
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (!secs || secs < 0) return '—';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Session List ──────────────────────────────────────────────────────────────
function SessionList({ onSelect, filters }) {
  const [data,    setData]    = useState({ sessions: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [offset,  setOffset]  = useState(0);
  const limit = 15;

  useEffect(() => {
    setLoading(true);
    api.getSessions({ ...filters, limit, offset })
      .then(setData)
      .catch(() => setData({ sessions: [], total: 0 }))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), offset]);

  if (loading) return <Empty>Carregando sessões…</Empty>;
  if (!data.sessions.length) return <Empty>Nenhuma sessão encontrada.</Empty>;

  return (
    <div>
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
        {data.total.toLocaleString()} sessões disponíveis para replay
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.sessions.map(s => (
          <SessionCard key={s.session_id} session={s} onSelect={onSelect} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <button onClick={() => setOffset(o => Math.max(0, o - limit))} disabled={offset === 0} style={pagBtn(offset === 0)}>
          ← Anterior
        </button>
        <span style={{ color: '#64748b', fontSize: 13 }}>
          {offset + 1}–{Math.min(offset + limit, data.total)} de {data.total}
        </span>
        <button onClick={() => setOffset(o => o + limit)} disabled={offset + limit >= data.total} style={pagBtn(offset + limit >= data.total)}>
          Próximo →
        </button>
      </div>
    </div>
  );
}

function SessionCard({ session: s, onSelect }) {
  const duration  = s.time_on_page || Math.round((new Date(s.end_time) - new Date(s.start_time)) / 1000);
  const pages     = [...new Set((s.pages_visited || '').split('|||').filter(Boolean))];
  const converted = (s.converted ?? 0) > 0;

  return (
    <div
      className="sr-session-card"
      onClick={() => onSelect(s.session_id)}
      style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
        padding: '12px 16px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: 12, transition: 'border-color 0.12s, background 0.12s' }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>
        {s.device_type === 'mobile' ? '📱' : s.device_type === 'tablet' ? '📟' : '🖥️'}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
          <code style={{ fontSize: 11, color: '#475569' }}>{s.session_id.slice(0, 20)}…</code>
          {converted
            ? <Pill bg="rgba(34,197,94,0.12)" border="rgba(34,197,94,0.3)" color="#4ade80">✓ Converteu</Pill>
            : <Pill bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.2)" color="#f87171">✕ Não converteu</Pill>
          }
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748b', flexWrap: 'wrap', marginBottom: 5 }}>
          <span>⏱ {formatDuration(duration)}</span>
          <span>🖱 {s.clicks ?? 0} cliques</span>
          <span>📄 {pages.length} pág.</span>
          <span>📜 {s.max_scroll ?? 0}% scroll</span>
          <span style={{ color: '#475569' }}>
            {new Date(s.start_time).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {pages.slice(0, 3).map(p => (
            <code key={p} style={{ background: '#1e293b', color: '#7dd3fc', fontSize: 11, padding: '1px 6px', borderRadius: 3 }}>
              {p.length > 45 ? p.slice(0, 45) + '…' : p}
            </code>
          ))}
          {pages.length > 3 && (
            <code style={{ background: '#1e293b', color: '#475569', fontSize: 11, padding: '1px 6px', borderRadius: 3 }}>
              +{pages.length - 3}
            </code>
          )}
        </div>
      </div>

      <button style={{ background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 8,
        color: '#7dd3fc', padding: '7px 14px', cursor: 'pointer', fontWeight: 700,
        fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
        ▶ Replay
      </button>
    </div>
  );
}

// ── Replay Player ─────────────────────────────────────────────────────────────
function ReplayPlayer({ sessionId, onBack, isModal }) {
  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [speed,        setSpeed]        = useState(1);
  const [hasRage,      setHasRage]      = useState(false);
  const [converted,    setConverted]    = useState(false);
  const [totalMs,      setTotalMs]      = useState(0);

  // DOM refs for 60fps updates (no React re-renders during playback)
  const cursorRef      = useRef(null);
  const progressRef    = useRef(null);
  const timeDisplayRef = useRef(null);
  const urlBarRef      = useRef(null);
  const scrollThumbRef = useRef(null);
  const viewportRef    = useRef(null);

  // Playback engine state in refs
  const playRef   = useRef({ t: 0, idx: 0, lastTs: null, speed: 1, playing: false });
  const eventsRef = useRef([]);
  const totalRef  = useRef(0);
  const rafRef    = useRef(null);

  useEffect(() => {
    api.getSessionReplay(sessionId)
      .then(d => {
        const evs = d.events || [];
        setEvents(evs);
        eventsRef.current = evs;
        totalRef.current  = d.duration_ms || 0;
        setTotalMs(d.duration_ms || 0);
        setHasRage(evs.some(e => e.rage_click));
        setConverted(evs.some(e => e.event_type === 'purchase'));
        // Set initial URL
        const fp = evs.find(e => e.event_type === 'page_view');
        if (fp && urlBarRef.current) urlBarRef.current.textContent = fp.page_url || '—';
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [sessionId]);

  useEffect(() => { playRef.current.speed = speed; }, [speed]);

  // Apply a single event to the DOM
  const applyEvent = useCallback((ev) => {
    if (ev.event_type === 'mouse_move' || ev.event_type === 'click') {
      const vw = ev.viewport_width  || 1440;
      const vh = ev.viewport_height || 900;
      const x  = Math.max(0, Math.min(1, (ev.x ?? 0) / vw));
      const y  = Math.max(0, Math.min(1, (ev.y ?? 0) / vh));

      if (cursorRef.current) {
        cursorRef.current.style.left = `${x * 100}%`;
        cursorRef.current.style.top  = `${y * 100}%`;
      }

      if (ev.event_type === 'click' && viewportRef.current) {
        const mkRipple = (size, anim, color, delay) => {
          const el = document.createElement('div');
          el.style.cssText = `position:absolute;left:${x*100}%;top:${y*100}%;` +
            `width:${size}px;height:${size}px;border-radius:50%;pointer-events:none;z-index:99;` +
            `border:2.5px solid ${color};animation:${anim} 0.75s ease-out ${delay} forwards;`;
          viewportRef.current.appendChild(el);
          setTimeout(() => el.remove(), 800 + parseInt(delay) || 800);
        };
        mkRipple(20, 'sr-ripple', ev.rage_click ? '#ef4444' : '#3b82f6', '0ms');
        if (ev.rage_click) mkRipple(36, 'sr-rage', 'rgba(239,68,68,0.5)', '0ms');
      }
    } else if (ev.event_type === 'scroll' && scrollThumbRef.current) {
      scrollThumbRef.current.style.top = `${ev.scroll_percent || 0}%`;
    } else if (ev.event_type === 'page_view' && urlBarRef.current) {
      urlBarRef.current.textContent = ev.page_url || '—';
    }
  }, []);

  // RAF tick — advances time and processes events
  const tick = useCallback((now) => {
    const p = playRef.current;
    if (!p.playing) return;
    if (p.lastTs === null) p.lastTs = now;

    const delta = (now - p.lastTs) * p.speed;
    p.lastTs = now;
    p.t     += delta;

    const evs   = eventsRef.current;
    const total = totalRef.current;

    while (p.idx < evs.length && evs[p.idx].t <= p.t) {
      applyEvent(evs[p.idx]);
      p.idx++;
    }

    // Update progress and clock directly (no state change)
    if (progressRef.current && total > 0) {
      progressRef.current.style.width = `${Math.min(100, (p.t / total) * 100)}%`;
    }
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = formatMs(p.t);
    }

    if (p.idx >= evs.length || p.t >= total + 100) {
      p.playing = false;
      setIsPlaying(false);
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [applyEvent]);

  const doPlay = useCallback(() => {
    const p = playRef.current;
    if (p.idx >= eventsRef.current.length) {
      p.t = 0; p.idx = 0;
      if (progressRef.current) progressRef.current.style.width = '0%';
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = '00:00';
      if (cursorRef.current) { cursorRef.current.style.left = '50%'; cursorRef.current.style.top = '20%'; }
    }
    p.lastTs  = null;
    p.playing = true;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const doPause = useCallback(() => {
    playRef.current.playing  = false;
    playRef.current.lastTs   = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const seekTo = useCallback((ms) => {
    doPause();
    const evs   = eventsRef.current;
    const total = totalRef.current;
    ms = Math.max(0, Math.min(ms, total));

    let cx = 0.5, cy = 0.2, sp = 0;
    let pg = evs.find(e => e.event_type === 'page_view')?.page_url || '—';
    let idx = 0;

    for (; idx < evs.length && evs[idx].t <= ms; idx++) {
      const ev = evs[idx];
      if (ev.event_type === 'mouse_move' || ev.event_type === 'click') {
        cx = Math.max(0, Math.min(1, (ev.x ?? 0) / (ev.viewport_width  || 1440)));
        cy = Math.max(0, Math.min(1, (ev.y ?? 0) / (ev.viewport_height || 900)));
      } else if (ev.event_type === 'scroll') { sp = ev.scroll_percent || 0; }
      else if (ev.event_type === 'page_view') { pg = ev.page_url || '—'; }
    }

    playRef.current.t   = ms;
    playRef.current.idx = idx;

    if (cursorRef.current)      { cursorRef.current.style.left = `${cx * 100}%`; cursorRef.current.style.top = `${cy * 100}%`; }
    if (scrollThumbRef.current) scrollThumbRef.current.style.top = `${sp}%`;
    if (urlBarRef.current)      urlBarRef.current.textContent = pg;
    if (progressRef.current && total > 0) progressRef.current.style.width = `${(ms / total) * 100}%`;
    if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatMs(ms);
  }, [doPause]);

  const clickEvents = events.filter(e => e.event_type === 'click');
  const meta = {
    device:   events[0]?.device_type || '—',
    duration: Math.round(totalMs / 1000),
    clicks:   clickEvents.length,
    evCount:  events.length,
    pages:    [...new Set(events.filter(e => e.event_type === 'page_view').map(e => e.page_url))],
  };

  const wrapper = isModal
    ? { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20 }
    : {};

  const card = isModal
    ? { background: '#0c1424', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 1040, border: '1px solid #1e293b',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)', maxHeight: '95vh', overflowY: 'auto' }
    : {};

  return (
    <div style={wrapper}>
      <div style={card}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isModal && (
              <button onClick={onBack} style={btnSecondary}>← Voltar</button>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                ▶️ Session Replay
                {hasRage    && <Pill bg="rgba(239,68,68,0.12)" border="rgba(239,68,68,0.3)"  color="#f87171">🤬 Rage Clicks</Pill>}
                {converted  && <Pill bg="rgba(34,197,94,0.12)"  border="rgba(34,197,94,0.3)"  color="#4ade80">✓ Converteu</Pill>}
              </div>
              <code style={{ fontSize: 11, color: '#334155' }}>{sessionId}</code>
            </div>
          </div>
          {isModal && (
            <button onClick={onBack} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', padding: '6px 12px', fontSize: 14, lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* Meta pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            [meta.device === 'mobile' ? '📱' : '🖥️', meta.device],
            ['⏱', formatDuration(meta.duration)],
            ['🖱', `${meta.clicks} cliques`],
            ['🗂', `${meta.evCount} eventos`],
          ].map(([icon, val], i) => (
            <div key={i} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 7, padding: '5px 11px', fontSize: 12, color: '#94a3b8' }}>
              {icon} {val}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* ── Browser mockup ──────────────────────────────────────────── */}
        <div style={{ background: '#0a0d17', borderRadius: 10, overflow: 'hidden', border: '1px solid #1e293b' }}>

          {/* Chrome bar */}
          <div style={{ background: '#141824', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#27c93f' }} />
            </div>
            <div style={{ flex: 1, background: '#0a0d17', border: '1px solid #1e293b', borderRadius: 5, padding: '4px 10px', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span ref={urlBarRef} style={{ color: '#64748b' }}>—</span>
            </div>
          </div>

          {/* Viewport */}
          <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '16/10', background: '#0a0f1a' }}>
            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 14 }}>
                <Spinner /> Carregando sessão…
              </div>
            ) : !events.length ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 13 }}>
                Sem eventos de mouse para esta sessão.
              </div>
            ) : (
              <>
                {/* Grid bg */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="sr-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#sr-grid)" />
                </svg>

                {/* Replay area — ripples appended here via DOM */}
                <div ref={viewportRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                  {/* Cursor */}
                  <div ref={cursorRef} style={{
                    position: 'absolute', left: '50%', top: '20%',
                    width: 20, height: 20,
                    transform: 'translate(-2px, -2px)',
                    pointerEvents: 'none', zIndex: 100,
                    transition: 'left 60ms linear, top 60ms linear',
                    filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <polygon points="3,2 3,16 6,13 8.5,17.5 10.5,16.5 8,12 13,12" fill="white" stroke="rgba(0,0,0,0.6)" strokeWidth="0.8" />
                    </svg>
                  </div>
                </div>

                {/* Scrollbar */}
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, background: 'rgba(255,255,255,0.04)', zIndex: 10 }}>
                  <div ref={scrollThumbRef} style={{
                    position: 'absolute', top: '0%', right: 0,
                    width: 6, height: '18%',
                    background: 'rgba(99,102,241,0.5)', borderRadius: 3,
                    transition: 'top 0.25s ease',
                  }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Timeline ────────────────────────────────────────────────── */}
        <div
          style={{ position: 'relative', height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 10 }}
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect();
            seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * totalMs);
          }}
        >
          {/* Track */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
            <div ref={progressRef} style={{ height: '100%', background: '#3b82f6', borderRadius: 2, width: '0%' }} />
          </div>
          {/* Click markers */}
          {clickEvents.map((ev, i) => (
            <div key={i} style={{
              position: 'absolute', top: '50%',
              transform: 'translate(-50%, -50%)',
              left: `${((ev.t / (totalMs || 1)) * 100)}%`,
              width: 3, height: ev.rage_click ? 12 : 8,
              background: ev.rage_click ? '#ef4444' : '#f97316',
              borderRadius: 2, pointerEvents: 'none',
            }} />
          ))}
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          {isPlaying
            ? <button onClick={doPause} style={{ ...btnPrimary, background: '#7f1d1d', border: '1px solid #dc2626' }}>⏸ Pausar</button>
            : <button onClick={doPlay} disabled={loading || !events.length} style={{ ...btnPrimary, opacity: loading || !events.length ? 0.4 : 1, cursor: loading || !events.length ? 'not-allowed' : 'pointer' }}>▶ Reproduzir</button>
          }

          {/* Speed */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[0.5, 1, 2, 4].map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={{
                padding: '5px 10px', fontSize: 12, fontWeight: 700,
                background: speed === s ? '#1e3a5f' : '#0f172a',
                border: `1px solid ${speed === s ? '#3b82f6' : '#1e293b'}`,
                borderRadius: 6, color: speed === s ? '#7dd3fc' : '#475569',
                cursor: 'pointer',
              }}>
                {s}×
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            <span ref={timeDisplayRef} style={{ color: '#94a3b8' }}>00:00</span>
            <span> / {formatDuration(meta.duration)}</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 11, color: '#475569', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f97316', marginRight: 4 }} />Clique</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ef4444', marginRight: 4 }} />Rage click</span>
          <span style={{ color: '#334155' }}>Clique na linha do tempo para navegar</span>
        </div>

        {/* Pages visited */}
        {meta.pages.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#475569' }}>Páginas:</span>
            {meta.pages.map(p => (
              <code key={p} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1px 7px', borderRadius: 4, color: '#7dd3fc', fontSize: 11 }}>
                {p.length > 55 ? p.slice(0, 55) + '…' : p}
              </code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function SessionReplay({ sessionId: propId, onClose, filters }) {
  const [activeId, setActiveId] = useState(propId || null);

  useEffect(() => {
    if (propId) setActiveId(propId);
  }, [propId]);

  const handleBack = () => {
    setActiveId(null);
    if (onClose) onClose();
  };

  if (activeId) {
    // isModal when launched from Sessions.jsx (has onClose)
    return <ReplayPlayer sessionId={activeId} onBack={handleBack} isModal={!!onClose} />;
  }

  return <SessionList onSelect={setActiveId} filters={filters} />;
}

// ── Small components / styles ─────────────────────────────────────────────────
function Pill({ bg, border, color, children }) {
  return (
    <span style={{ fontSize: 11, background: bg, border: `1px solid ${border}`, color,
      borderRadius: 99, padding: '2px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function Empty({ children }) {
  return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#334155', fontSize: 14 }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14,
      border: '2px solid #1e293b', borderTopColor: '#3b82f6',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 8 }} />
  );
}

const btnPrimary = {
  padding: '7px 18px', background: '#1e3a5f', border: '1px solid #3b82f6',
  borderRadius: 7, color: '#7dd3fc', cursor: 'pointer', fontWeight: 700, fontSize: 13,
};

const btnSecondary = {
  padding: '6px 14px', background: 'transparent',
  border: '1px solid #334155', borderRadius: 6, color: '#94a3b8',
  cursor: 'pointer', fontSize: 13,
};

function pagBtn(disabled) {
  return {
    padding: '7px 16px', background: disabled ? '#1e293b' : '#0f172a',
    border: '1px solid #334155', borderRadius: 6,
    color: disabled ? '#334155' : '#94a3b8',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13,
  };
}
