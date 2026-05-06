import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

export default function SessionReplay({ sessionId, onClose }) {
  const canvasRef    = useRef(null);
  const timerRef     = useRef(null);
  const [events, setEvents]   = useState([]);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx]         = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSession(sessionId)
      .then(d => setEvents(d.events || []))
      .finally(() => setLoading(false));
    return () => clearTimeout(timerRef.current);
  }, [sessionId]);

  const mouseEvents = events.filter(e => ['mouse_move', 'click'].includes(e.event_type));

  const drawFrame = useCallback((i) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Grid background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 50) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    const trail = mouseEvents.slice(Math.max(0, i - 30), i + 1);
    if (trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      trail.forEach((e, ti) => {
        const x = norm(e.x, e.viewport_width, 1440) * W;
        const y = norm(e.y, e.viewport_height, 900) * H;
        ti === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const cur = mouseEvents[i];
    if (!cur) return;
    const cx = norm(cur.x, cur.viewport_width, 1440) * W;
    const cy = norm(cur.y, cur.viewport_height, 900) * H;

    if (cur.event_type === 'click') {
      for (let r = 28; r > 0; r -= 4) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.04 + (28 - r) * 0.015})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // Cursor dot
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = cur.event_type === 'click' ? '#ef4444' : '#6366f1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }, [mouseEvents]);

  const play = useCallback(() => {
    if (!mouseEvents.length) return;
    setPlaying(true);
    setIdx(0);
    step(0);
  }, [mouseEvents]);

  const step = useCallback((i) => {
    if (i >= mouseEvents.length) { setPlaying(false); return; }
    setIdx(i);
    drawFrame(i);

    const next  = mouseEvents[i + 1];
    if (!next) { setPlaying(false); return; }

    const gap = Math.min(
      new Date(next.created_at) - new Date(mouseEvents[i].created_at),
      1500
    );
    timerRef.current = setTimeout(() => step(i + 1), Math.max(gap, 16));
  }, [mouseEvents, drawFrame]);

  const stop = () => {
    clearTimeout(timerRef.current);
    setPlaying(false);
  };

  const meta = {
    pages: [...new Set(events.map(e => e.page_url).filter(Boolean))],
    device: events[0]?.device_type || '—',
    duration: events.length > 1
      ? Math.round((new Date(events.at(-1).created_at) - new Date(events[0].created_at)) / 1000)
      : 0,
    clicks: events.filter(e => e.event_type === 'click').length,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 920, boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        border: '1px solid #334155',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Replay de sessão</h3>
            <code style={{ fontSize: 11, color: '#64748b' }}>{sessionId}</code>
          </div>
          <button onClick={onClose} style={{
            background: '#334155', border: 'none', borderRadius: 6,
            color: '#94a3b8', cursor: 'pointer', padding: '6px 10px', fontSize: 16, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            ['Device', meta.device],
            ['Duração', `${meta.duration}s`],
            ['Cliques', meta.clicks],
            ['Eventos', events.length],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#0f172a', borderRadius: 6, padding: '6px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ background: '#0a0f1a', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e293b' }}>
          {loading
            ? <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Carregando sessão…</div>
            : <canvas ref={canvasRef} width={860} height={430} style={{ display: 'block', width: '100%' }} />
          }
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          {playing ? (
            <button onClick={stop} style={{ padding: '8px 20px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              ⏹ Parar
            </button>
          ) : (
            <button onClick={play} disabled={!mouseEvents.length || loading} style={{
              padding: '8px 20px',
              background: (!mouseEvents.length || loading) ? '#334155' : '#3b82f6',
              border: 'none', borderRadius: 6, color: '#fff',
              cursor: (!mouseEvents.length || loading) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}>
              ▶ Iniciar Replay
            </button>
          )}
          <div style={{ flex: 1, background: '#0f172a', borderRadius: 4, height: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#3b82f6',
              width: mouseEvents.length ? `${Math.round((idx / mouseEvents.length) * 100)}%` : '0%',
              transition: 'width 0.1s linear',
            }} />
          </div>
          <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
            {idx} / {mouseEvents.length} eventos
          </span>
        </div>

        {meta.pages.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
            Páginas: {meta.pages.map(p => (
              <code key={p} style={{
                background: '#0f172a', padding: '1px 6px', borderRadius: 3,
                color: '#7dd3fc', marginRight: 6,
              }}>{p}</code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function norm(v, vp, fallback) {
  return v != null && vp ? v / vp : v != null ? v / fallback : 0.5;
}
