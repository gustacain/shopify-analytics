import React, { useRef, useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import AIAnalysis from './AIAnalysis';

const SCREENSHOT_W = 1440;
const SCREENSHOT_H = 900;

function buildScreenshotUrl(storeUrl, pagePath, device, nocache = false) {
  if (!storeUrl || !pagePath) return null;
  const base   = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const path   = pagePath.startsWith('/') ? pagePath : '/' + pagePath;
  const target = encodeURIComponent(`https://${base}${path}`);
  const dev    = device === 'mobile' ? '&device=mobile' : '';
  return `https://efficient-love-production-2ed0.up.railway.app/api/screenshot?url=${target}${dev}${nocache ? '&nocache=1' : ''}`;
}

export default function Heatmap({ filters, selectedPage, onPageConsumed }) {
  const canvasRef          = useRef(null);
  const [storeUrl, setStoreUrl] = useState(() => localStorage.getItem('sa_store_url') || '');
  const [page, setPage]    = useState('');
  const [data, setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]  = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [imgStatus, setImgStatus] = useState('idle'); // idle | loading | ok | error

  const canvasW = filters.device === 'mobile' ? 390  : SCREENSHOT_W;
  const canvasH = filters.device === 'mobile' ? 844  : SCREENSHOT_H;

  const draw = useCallback((clicks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W   = canvas.width;
    const H   = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (!clicks.length) return;

    const maxCount = Math.max(...clicks.map(c => c.count), 1);

    const off    = document.createElement('canvas');
    off.width    = W;
    off.height   = H;
    const octx   = off.getContext('2d');

    clicks.forEach(click => {
      const vw = click.viewport_width  || W;
      const vh = click.viewport_height || H;
      // clientX/clientY are always within [0, vw] × [0, vh]; clamp for older pageX/Y data
      const cx = Math.min(1, Math.max(0, click.x / vw)) * W;
      const cy = Math.min(1, Math.max(0, click.y / vh)) * H;
      const t  = click.count / maxCount;
      const r  = 22 + t * 40;

      const g = octx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,   `rgba(255,  30,   0, ${(0.5 + t * 0.45).toFixed(2)})`);
      g.addColorStop(0.4, `rgba(255, 140,   0, ${(0.25 + t * 0.3).toFixed(2)})`);
      g.addColorStop(1,   'rgba(0, 0, 0, 0)');

      octx.globalCompositeOperation = 'source-over';
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(cx, cy, r, 0, Math.PI * 2);
      octx.fill();
    });

    ctx.drawImage(off, 0, 0);

    // Dot per cluster centroid
    clicks.forEach(click => {
      const vw = click.viewport_width  || W;
      const vh = click.viewport_height || H;
      const cx = Math.min(1, Math.max(0, click.x / vw)) * W;
      const cy = Math.min(1, Math.max(0, click.y / vh)) * H;
      const t  = click.count / maxCount;
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + t * 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, ${Math.round(200 * (1 - t))}, 0, 0.85)`;
      ctx.fill();
    });
  }, []);

  const loadPageData = async (targetPage, targetStore) => {
    const p = (targetPage || page).trim();
    const s = (targetStore !== undefined ? targetStore : storeUrl).trim();
    if (!p) { setError('Informe a URL da página'); return; }
    setPage(p);
    setError('');
    setLoading(true);

    if (s) {
      localStorage.setItem('sa_store_url', s);
      setScreenshotUrl(buildScreenshotUrl(s, p, filters.device));
      setImgStatus('loading');
    }

    try {
      const res = await api.getHeatmap(p, filters);
      setData(res);
      requestAnimationFrame(() => draw(res.clicks || []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load quando page vem do Filters do topo (Aplicar)
  useEffect(() => {
    if (!filters.page) return;
    const stored = localStorage.getItem('sa_store_url') || '';
    setStoreUrl(stored);
    loadPageData(filters.page, stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page]);

  // Recarrega screenshot quando device muda e já há página carregada
  useEffect(() => {
    if (!page || !storeUrl) return;
    setScreenshotUrl(buildScreenshotUrl(storeUrl, page, filters.device, true));
    setImgStatus('loading');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.device]);

  // Auto-load when page is selected from PageList
  useEffect(() => {
    if (!selectedPage) return;
    setPage(selectedPage);
    onPageConsumed?.();
    // trigger load after state settles
    setTimeout(() => {
      const stored = localStorage.getItem('sa_store_url') || '';
      setStoreUrl(stored);
      loadPageData(selectedPage, stored);
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage]);

  // Redraw whenever data or screenshot finishes loading
  useEffect(() => {
    if (data?.clicks && imgStatus !== 'loading') {
      requestAnimationFrame(() => draw(data.clicks));
    }
  }, [data, imgStatus, draw]);

  const canvasStyle = {
    position: screenshotUrl ? 'absolute' : 'relative',
    top: 0, left: 0,
    width: '100%', height: screenshotUrl ? '100%' : undefined,
    aspectRatio: screenshotUrl ? undefined : `${canvasW}/${canvasH}`,
    pointerEvents: 'none',
    display: 'block',
  };

  return (
    <div>
      {/* Domínio da loja (para montar a URL do screenshot) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
          <span style={labelStyle}>Domínio da loja</span>
          <input
            value={storeUrl}
            onChange={e => setStoreUrl(e.target.value)}
            placeholder="minhaloja.myshopify.com"
            style={inputStyle}
          />
        </div>
      </div>

      {!storeUrl && (
        <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 12px', marginBottom: 10 }}>
          Informe o domínio da loja para carregar o screenshot de fundo.
        </div>
      )}

      {error && <div style={{ color: '#f87171', marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Heatmap area */}
      <div style={{
        position: 'relative', borderRadius: 10, overflow: 'hidden',
        background: '#0a0f1a', border: '1px solid #1e293b',
        aspectRatio: `${canvasW}/${canvasH}`,
      }}>
        {/* Screenshot background */}
        {screenshotUrl && (
          <img
            src={screenshotUrl}
            alt="screenshot da página"
            onLoad={() => setImgStatus('ok')}
            onError={() => setImgStatus('error')}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Screenshot status overlays */}
        {imgStatus === 'loading' && (
          <div style={overlayStyle}>
            <Spinner /> Gerando screenshot…
          </div>
        )}
        {imgStatus === 'error' && (
          <div style={{ ...overlayStyle, flexDirection: 'column', gap: 10 }}>
            <span style={{ color: '#f87171' }}>Falha ao gerar screenshot. Verifique o domínio ou tente novamente.</span>
            <button
              onClick={() => { setScreenshotUrl(buildScreenshotUrl(storeUrl, page, filters.device, true)); setImgStatus('loading'); }}
              style={btnStyle(false)}
            >
              🔄 Tentar novamente
            </button>
          </div>
        )}
        {!screenshotUrl && !data && (
          <div style={overlayStyle}>
            🖱️&nbsp; Digite o domínio e a página e clique em Carregar
          </div>
        )}
        {screenshotUrl === null && data && !data.clicks?.length && (
          <div style={overlayStyle}>Nenhum clique registrado para esta página.</div>
        )}

        {/* Heatmap canvas overlay */}
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={canvasStyle}
        />
      </div>

      {/* Reload screenshot button */}
      {screenshotUrl && imgStatus === 'ok' && (
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <button
            onClick={() => { setScreenshotUrl(buildScreenshotUrl(storeUrl, page, filters.device, true)); setImgStatus('loading'); }}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            🔄 Atualizar screenshot
          </button>
        </div>
      )}

      {/* Stats */}
      {data && (
        <div style={{ marginTop: 12, display: 'flex', gap: 24, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap' }}>
          <span>Total de cliques: <b style={{ color: '#e2e8f0' }}>{data.total?.toLocaleString()}</b></span>
          <span>Clusters: <b style={{ color: '#e2e8f0' }}>{data.clicks?.length}</b></span>
          {data.top_elements?.[0] && (
            <span>
              Elemento #1:{' '}
              <code style={{ background: '#1e293b', padding: '1px 6px', borderRadius: 4, color: '#7dd3fc', fontSize: 11 }}>
                {data.top_elements[0].element.slice(0, 50)}
              </code>
              {' '}({data.top_elements[0].count}×)
            </span>
          )}
        </div>
      )}

      {/* Top elements table */}
      {data?.top_elements?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Top elementos clicados
          </div>
          {data.top_elements.slice(0, 8).map((el, i) => {
            const maxC = data.top_elements[0].count;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 18, textAlign: 'right', color: '#475569', fontSize: 12 }}>{i + 1}.</span>
                <div style={{ flex: 1, background: '#1e293b', borderRadius: 4, height: 26, position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.round((el.count / maxC) * 100)}%`,
                    background: `rgba(59,130,246,${0.15 + (el.count / maxC) * 0.45})`,
                    transition: 'width 0.4s ease',
                  }} />
                  <code style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#7dd3fc' }}>
                    {el.element.slice(0, 70)}
                  </code>
                </div>
                <span style={{ width: 36, textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>{el.count}×</span>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Analysis */}
      <AIAnalysis
        pageUrl={page}
        heatmapData={data}
        screenshotUrl={screenshotUrl}
        filters={filters}
      />
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid #334155', borderTopColor: '#3b82f6',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6,
    }} />
  );
}

// Inject spin keyframe once
if (typeof document !== 'undefined' && !document.getElementById('sa-spin')) {
  const s = document.createElement('style');
  s.id = 'sa-spin';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

const labelStyle = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = { padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, width: '100%' };
const overlayStyle = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 14, gap: 6 };
const btnStyle = (disabled) => ({
  padding: '8px 18px', background: disabled ? '#334155' : '#3b82f6',
  border: 'none', borderRadius: 6, color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
});
