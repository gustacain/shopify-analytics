import React from 'react';

const s = {
  row: {
    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
    background: '#1e293b', padding: '14px 16px', borderRadius: 10,
    marginBottom: 20, border: '1px solid #334155',
  },
  group: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    padding: '7px 10px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 6, color: '#e2e8f0', fontSize: 13, minWidth: 140,
  },
  select: {
    padding: '7px 10px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 6, color: '#e2e8f0', fontSize: 13,
  },
  btn: {
    padding: '7px 16px', background: '#3b82f6', border: 'none',
    borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    alignSelf: 'flex-end',
  },
};

export default function Filters({ value, onChange, onApply, showPage = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <div style={s.row}>
      {showPage && (
        <div style={s.group}>
          <span style={s.label}>Página</span>
          <input
            style={s.input}
            placeholder="/products/exemplo"
            value={value.page || ''}
            onChange={e => set('page', e.target.value)}
          />
        </div>
      )}

      <div style={s.group}>
        <span style={s.label}>De</span>
        <input
          style={s.input} type="datetime-local"
          value={value.from || ''}
          onChange={e => set('from', e.target.value)}
        />
      </div>

      <div style={s.group}>
        <span style={s.label}>Até</span>
        <input
          style={s.input} type="datetime-local"
          value={value.to || ''}
          onChange={e => set('to', e.target.value)}
        />
      </div>

      <div style={s.group}>
        <span style={s.label}>Device</span>
        <select style={s.select} value={value.device || ''} onChange={e => set('device', e.target.value)}>
          <option value="">Todos</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
      </div>

      <button style={s.btn} onClick={onApply}>Aplicar</button>
    </div>
  );
}
