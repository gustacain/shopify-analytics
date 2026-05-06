const express = require('express');
const router  = express.Router();

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h em ms
const cache     = new Map(); // cacheKey -> { buf: Buffer, ts: number }
const inflight  = new Map(); // cacheKey -> Promise<Buffer>  (deduplicação)

async function capture(url) {
  const puppeteer = require('puppeteer-core');
  const chromium  = require('@sparticuz/chromium');

  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: { width: 1440, height: 900 },
    executablePath:  await chromium.executablePath(),
    headless:        chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Bloqueia recursos desnecessários para acelerar a captura
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['media', 'font', 'websocket'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const raw = await page.screenshot({
      type:    'jpeg',
      quality: 80,
      clip:    { x: 0, y: 0, width: 1440, height: 900 },
    });
    // puppeteer-core v23+ retorna Uint8Array; garante Buffer para res.send()
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  } finally {
    await browser.close().catch(() => {});
  }
}

// GET /api/screenshot?url=https://loja.myshopify.com/products/xyz
// GET /api/screenshot?url=...&nocache=1   → ignora cache, gera novo screenshot
router.get('/', async (req, res) => {
  const { url, nocache } = req.query;

  if (!url) return res.status(400).json({ error: 'Parâmetro ?url= obrigatório' });

  let parsed;
  try   { parsed = new URL(url); }
  catch { return res.status(400).json({ error: 'URL inválida' }); }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Apenas URLs http/https são permitidas' });
  }

  // Chave de cache = origin + pathname (ignora query string da loja)
  const key = parsed.origin + parsed.pathname;

  // Cache hit
  if (!nocache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      return res
        .set('Content-Type', 'image/jpeg')
        .set('Cache-Control', 'public, max-age=86400')
        .set('X-Cache', 'HIT')
        .send(hit.buf);
    }
  }

  // Deduplica requisições concorrentes para a mesma URL
  if (!inflight.has(key)) {
    const promise = capture(url)
      .then(buf => { cache.set(key, { buf, ts: Date.now() }); return buf; })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }

  try {
    const buf = await inflight.get(key);
    res
      .set('Content-Type', 'image/jpeg')
      .set('Cache-Control', 'public, max-age=86400')
      .set('X-Cache', 'MISS')
      .send(buf);
  } catch (e) {
    console.error('[screenshot]', e.message);
    res.status(502).json({ error: 'Falha ao capturar screenshot: ' + e.message });
  }
});

module.exports = router;
