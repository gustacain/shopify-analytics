import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../api';

const COLORS = ['#6366f1','#3b82f6','#06b6d4','#10b981','#22c55e'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
      padding: '10px 14px', fontSize: 13,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>{d.icon} {d.label}</p>
      <p style={{ color: '#94a3b8' }}>Sessões: <b style={{ color: '#e2e8f0' }}>{d.sessions.toLocaleString()}</b></p>
      <p style={{ color: '#94a3b8' }}>Conversão geral: <b style={{ color: '#10b981' }}>{d.overall_conversion}%</b></p>
      {d.dropoff_from_prev > 0 && (
        <p style={{ color: '#f87171', marginTop: 4 }}>Drop-off: {d.dropoff_from_prev}%</p>
      )}
    </div>
  );
}

export default function Funnel({ filters }) {
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getFunnel(filters)
      .then(r => setData(r.funnel || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  if (loading) return <Placeholder>Carregando funil...</Placeholder>;
  if (!data.length) return <Placeholder>Nenhum dado de funil.</Placeholder>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="sessions" radius={[4,4,0,0]}>
            {data.map((entry, i) => (
              <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        {data.map((stage, i) => (
          <div key={stage.key} style={{
            flex: '1 1 160px', background: '#1e293b', borderRadius: 10,
            padding: '14px 16px', border: '1px solid #334155',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{stage.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{stage.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS[i % COLORS.length] }}>
              {stage.sessions.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>sessões</div>
            {stage.dropoff_from_prev > 0 && (
              <div style={{
                marginTop: 8, fontSize: 12, color: '#fbbf24',
                background: 'rgba(251,191,36,0.1)', padding: '3px 8px',
                borderRadius: 4, display: 'inline-block',
              }}>
                -{stage.dropoff_from_prev}% drop-off
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ children }) {
  return (
    <div style={{
      height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#475569', fontSize: 15,
    }}>
      {children}
    </div>
  );
}
