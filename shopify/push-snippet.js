#!/usr/bin/env node
// Sobe o analytics.liquid para o tema ativo da Shopify via Admin API
// Uso: SHOPIFY_DOMAIN=loja.myshopify.com SHOPIFY_TOKEN=shpat_xxx node push-snippet.js

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DOMAIN  = (process.env.SHOPIFY_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN   = process.env.SHOPIFY_TOKEN;
const VERSION = '2024-10';

if (!DOMAIN || !TOKEN) {
  console.error('Uso: SHOPIFY_DOMAIN=loja.myshopify.com SHOPIFY_TOKEN=shpat_xxx node push-snippet.js');
  process.exit(1);
}

const snippetPath = path.join(__dirname, 'analytics.liquid');
const content     = fs.readFileSync(snippetPath, 'utf8');

function shopifyRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: DOMAIN,
      path:     `/admin/api/${VERSION}${urlPath}`,
      method,
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { reject(new Error('Parse error: ' + buf.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Busca o tema principal publicado
  const { body: themesBody } = await shopifyRequest('GET', '/themes.json?role=main');
  const themes = themesBody.themes || [];
  if (!themes.length) throw new Error('Nenhum tema principal encontrado.');
  const theme = themes[0];
  console.log(`Tema: "${theme.name}" (ID: ${theme.id})`);

  // Faz o upload do snippet
  const { status, body: result } = await shopifyRequest('PUT', `/themes/${theme.id}/assets.json`, {
    asset: { key: 'snippets/shopify-analytics.liquid', value: content },
  });

  if (result.asset) {
    const kb = (result.asset.size / 1024).toFixed(1);
    console.log(`✅ Snippet atualizado: ${result.asset.key} (${kb} KB)`);
  } else {
    console.error('❌ Erro HTTP', status, JSON.stringify(result.errors || result, null, 2));
    process.exit(1);
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
