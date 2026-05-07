const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  health:          ()           => request('/health'),

  getHeatmap:      (page, f={}) => request(`/heatmap?${qs({ page, ...f })}`),
  getScrollDepth:  (f={})       => request(`/scroll-depth?${qs(f)}`),
  getSessions:     (f={})       => request(`/sessions?${qs(f)}`),
  getSession:      (id)         => request(`/sessions/${encodeURIComponent(id)}`),
  getFunnel:       (f={})       => request(`/funnel?${qs(f)}`),
  getPages:        (f={})       => request(`/pages?${qs(f)}`),

  // Shopify Admin API proxy — token sent as header, never in URL
  shopifyShop: (shop, token) =>
    request(`/shopify/shop?${qs({ shop })}`, { headers: { 'x-shopify-token': token } }),

  shopifyProducts: (shop, token) =>
    request(`/shopify/products?${qs({ shop })}`, { headers: { 'x-shopify-token': token } }),

  shopifyPages: (shop, token) =>
    request(`/shopify/pages?${qs({ shop })}`, { headers: { 'x-shopify-token': token } }),

  getWebhookConfig:    ()       => request('/webhook/config'),
  saveWebhookConfig:   (body)   => request('/webhook/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  triggerDailySummary: ()       => request('/webhook/daily-summary', { method: 'POST' }),

  aiAnalyze: (body) => request('/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
};

function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  }
  return p.toString();
}
