const express = require('express');
const router  = express.Router();

const API_VERSION = '2024-10';

async function shopifyFetch(shop, token, path) {
  const { default: fetch } = await import('node-fetch');
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url    = `https://${domain}/admin/api/${API_VERSION}${path}`;

  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Shopify ${res.status}`), { status: res.status, body });
  }
  return res.json();
}

// GET /api/shopify/products
// Returns all products with handle + title for URL enrichment
router.get('/products', async (req, res) => {
  const shop  = req.query.shop;
  const token = req.headers['x-shopify-token'];

  if (!shop)  return res.status(400).json({ error: 'Missing query param: shop' });
  if (!token) return res.status(400).json({ error: 'Missing header: x-shopify-token' });

  try {
    // Fetch up to 250 products (one page — enough for most stores)
    const data = await shopifyFetch(
      shop, token,
      '/products.json?fields=id,handle,title,status,product_type&limit=250'
    );
    res.json(data); // { products: [...] }
  } catch (e) {
    console.error('[shopify]', e.message);
    res.status(e.status || 502).json({ error: e.message });
  }
});

// GET /api/shopify/pages
// Returns published CMS pages (About, FAQ, etc.)
router.get('/pages', async (req, res) => {
  const shop  = req.query.shop;
  const token = req.headers['x-shopify-token'];

  if (!shop || !token) return res.status(400).json({ error: 'Missing shop or token' });

  try {
    const data = await shopifyFetch(
      shop, token,
      '/pages.json?fields=id,handle,title&limit=250'
    );
    res.json(data); // { pages: [...] }
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

// GET /api/shopify/shop — basic store info + connection test
router.get('/shop', async (req, res) => {
  const shop  = req.query.shop;
  const token = req.headers['x-shopify-token'];

  if (!shop || !token) return res.status(400).json({ error: 'Missing shop or token' });

  try {
    const data = await shopifyFetch(shop, token, '/shop.json');
    res.json(data); // { shop: { name, domain, ... } }
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

module.exports = router;
