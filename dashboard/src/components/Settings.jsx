import React, { useState } from 'react';
import { api } from '../api';

export default function Settings({ onSave }) {
  const [domain, setDomain]   = useState(() => localStorage.getItem('sa_store_url')      || '');
  const [token,  setToken]    = useState(() => localStorage.getItem('sa_shopify_token')   || '');
  const [saved,  setSaved]    = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const save = () => {
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const t = token.trim();
    localStorage.setItem('sa_store_url',     d);
    localStorage.setItem('sa_shopify_token', t);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSave?.({ domain: d, token: t });
  };

  const testConnection = async () => {
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const t = token.trim();
    if (!d || !t) { setTestResult({ ok: false, msg: 'Preencha o domínio e o token antes de testar.' }); return; }

    setTesting(true);
    setTestResult(null);
    try {
      const data = await api.shopifyShop(d, t);
      setTestResult({ ok: true, msg: `Conectado: ${data.shop?.name} (${data.shop?.domain})` });
    } catch (e) {
      setTestResult({ ok: false, msg: `Erro: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 580 }}>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        Configure as credenciais da sua loja Shopify. Os dados são salvos no{' '}
        <code style={codeStyle}>localStorage</code> do browser — apenas você tem acesso.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Domain */}
        <div>
          <label style={labelStyle}>Domínio da loja</label>
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="minhaloja.myshopify.com"
            style={inputStyle}
            autoComplete="off"
          />
          <p style={hintStyle}>Sem https:// — só o domínio. Ex: <code style={codeStyle}>minhaloja.myshopify.com</code></p>
        </div>

        {/* Token */}
        <div>
          <label style={labelStyle}>Shopify Admin API Token</label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
            style={inputStyle}
            autoComplete="new-password"
          />
          <p style={hintStyle}>
            Gere em: <b>Apps → Develop apps → Create an app → Admin API access token</b>.
            Permissões necessárias: <code style={codeStyle}>read_products</code>, <code style={codeStyle}>read_content</code>.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={save} style={primaryBtn}>
            {saved ? '✓ Salvo!' : 'Salvar configuração'}
          </button>
          <button onClick={testConnection} disabled={testing} style={secondaryBtn(testing)}>
            {testing ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: testResult.ok ? 'rgba(34,197,94,0.1)'  : 'rgba(239,68,68,0.1)',
            border:     `1px solid ${testResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color:      testResult.ok ? '#4ade80' : '#f87171',
          }}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
          </div>
        )}
      </div>

      {/* How to get a token */}
      <div style={{
        marginTop: 36, padding: '18px 20px', background: '#0f172a',
        borderRadius: 10, border: '1px solid #1e293b',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Como gerar o Admin API token</h3>
        {[
          'Shopify Admin → Configurações → Apps e canais de vendas',
          'Clique em "Desenvolver apps" (canto superior direito)',
          'Clique em "Criar app" → dê um nome (ex: Analytics Dashboard)',
          'Em "Configuração da API de Admin" → Editar → marque read_products e read_content → Salvar',
          'Aba "Credenciais da API" → clique em "Instalar app" → copie o "Token de acesso da API de Admin"',
          'Cole o token acima e clique em Salvar',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13, color: '#94a3b8', alignItems: 'flex-start' }}>
            <span style={{
              background: '#1e293b', borderRadius: '50%', width: 22, height: 22,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#3b82f6', flexShrink: 0, marginTop: 1,
            }}>{i + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 6 };
const hintStyle  = { fontSize: 12, color: '#475569', marginTop: 6 };
const codeStyle  = { background: '#1e293b', padding: '1px 5px', borderRadius: 3, color: '#7dd3fc', fontSize: 11 };
const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: '#0f172a', border: '1px solid #334155',
  borderRadius: 6, color: '#e2e8f0', fontSize: 14,
};
const primaryBtn = {
  padding: '9px 22px', background: '#3b82f6', border: 'none',
  borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
};
const secondaryBtn = (disabled) => ({
  padding: '9px 22px', background: 'transparent',
  border: '1px solid #334155', borderRadius: 6,
  color: disabled ? '#475569' : '#94a3b8',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14,
});
