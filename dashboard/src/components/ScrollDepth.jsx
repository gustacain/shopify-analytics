import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { api } from '../api';

const COLORS = { 25: '#ef4444', 50: '#f97316', 75: '#eab308', 100: '#22c55e' };

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <p style={{ fontWeight: 700 }}>{d.threshold}% da página</p>
      <p style={{ color: '#94a3b8', marginTop: 4 }}>
        Sessões: <b style={{ color: '#e2e8f0' }}>{d.sessions.toLocaleString()}</b>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Taxa: <b style={{ color: COLORS[d.threshold] }}>{d.pct}%</b>
      </p>
    </div>
  );
}

export default function ScrollDepth({ filters }) {
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api.getScrollDepth(filters)
      .then(r => {
        if (cancelled) return;
        setData(r.scroll_depth || []);
        setTotal(r.total_sessions || 0);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message || 'Erro ao carregar scroll depth');
        setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [JSON.stringify(filters)]);

  if (loading) return <Placeholder>Carregando scroll depth…</Placeholder>;

  if (error) return (
    <div style={{ padding: '16px', color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: 13 }}>
      Erro: {error}
    </div>
  );

  if (!data.length) return <Placeholder>Nenhum dado de scroll no período.</Placeholder>;

  const chartData = data.map(d => ({
    ...d,
    name:  `${d.threshold}%`,
    fill:  COLORS[d.threshold] || '#3b82f6',
  }));

  return (
    <div>
      <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 13 }}>
        <b style={{ color: '#e2e8f0' }}>{total.toLocaleString()}</b> sessões no período
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 24, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => `${v}%`}
            domain={[0, Math.max(100, ...chartData.map(d => d.pct))]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false} tickLine={false} width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={80}>
            {chartData.map(entry => (
              <Cell key={entry.threshold} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="pct"
              position="top"
              formatter={v => `${v}%`}
              style={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {data.map(d => (
          <div key={d.threshold} style={{
            flex: '1 1 130px', background: '#1e293b', borderRadius: 10,
            padding: '14px 16px', border: `1px solid ${COLORS[d.threshold]}33`,
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: COLORS[d.threshold], lineHeight: 1 }}>
              {d.pct}%
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              chegaram a {d.threshold}% da página
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              {d.sessions.toLocaleString()} sessões
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ children }) {
  return (
    <div style={{
      height: 180, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#475569', fontSize: 14,
    }}>
      {children}
    </div>
  );
}
