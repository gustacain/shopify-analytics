# Guia de instalação — Shopify Analytics

## Pré-requisitos

- Node.js 18+
- Conta Shopify com acesso ao editor de temas
- Servidor com IP/domínio público acessível pela loja (ou ngrok para testes locais)

---

## 1. Instalar e iniciar o sistema localmente

```bash
# Instalar todas as dependências
npm run install:all

# Iniciar API (porta 3001) + Dashboard (porta 5173)
npm run dev
```

O terminal exibirá:
```
  API  -> http://localhost:3001
  UI   -> http://localhost:5173
```

Abra **http://localhost:5173** para acessar o dashboard.

---

## 2. Expor a API publicamente (para uso com loja real)

Use **ngrok** para criar um túnel temporário durante o desenvolvimento:

```bash
# Instale ngrok: https://ngrok.com/download
ngrok http 3001
```

Anote a URL gerada (ex.: `https://abc123.ngrok-free.app`). Use-a no passo 4.

Para produção, faça deploy do diretório `backend/` em qualquer servidor Node.js
(Railway, Render, Fly.io, VPS) e use a URL pública permanente.

---

## 3. Adicionar o snippet ao tema Shopify

### 3a. Acesse o editor de código do tema

1. Shopify Admin → **Loja online** → **Temas**
2. No tema ativo, clique em **⋯ → Editar código**

### 3b. Criar o arquivo do snippet

1. Em **Snippets**, clique em **Adicionar um novo snippet**
2. Nome: `shopify-analytics`
3. Clique em **Criar snippet**
4. Apague todo o conteúdo gerado automaticamente
5. Cole o conteúdo do arquivo `shopify/analytics.liquid` deste projeto
6. Clique em **Salvar**

### 3c. Incluir o snippet no layout principal

1. Em **Layout**, abra `theme.liquid`
2. Localize a tag `</body>` (próximo ao final do arquivo)
3. Logo **acima** de `</body>`, adicione:

```liquid
{% render 'shopify-analytics', api_url: 'https://SUA-URL-PUBLICA.com' %}
```

> Substitua `https://SUA-URL-PUBLICA.com` pela URL do passo 2.

4. Clique em **Salvar**

---

## 4. Verificar a instalação

1. Abra qualquer página da sua loja
2. Abra as DevTools do navegador → aba **Network**
3. Filtre por `/api/events`
4. Você deverá ver requisições POST com status `201`

No dashboard (**http://localhost:5173**) você verá os dados aparecerem em tempo real.

---

## 5. Configurar alertas no n8n (opcional)

### 5a. Acesse a aba "n8n / Webhooks" no dashboard

1. Informe a URL do seu webhook n8n
2. Defina o threshold de abandono de carrinho (padrão: 70%)
3. Clique em **Salvar configuração**

### 5b. Criar o workflow n8n

1. Crie um workflow com nó **Webhook**
2. Selecione método: `POST`
3. Copie a URL gerada e cole no dashboard
4. Adicione nós para processar os payloads:

**Payload de alerta de abandono:**
```json
{
  "type": "cart_abandonment_alert",
  "abandon_rate_pct": 75,
  "threshold_pct": 70,
  "cart_sessions": 120,
  "checkout_sessions": 30,
  "window": "last_24h",
  "ts": "2026-05-05T14:30:00.000Z"
}
```

**Payload de resumo diário:**
```json
{
  "type": "daily_summary",
  "date": "05/05/2026",
  "page_views": 1250,
  "sessions": 430,
  "clicks": 3100,
  "cart_sessions": 89,
  "purchases": 22,
  "abandoned_carts": 67,
  "conversion_rate": "24%",
  "abandon_rate": "75%",
  "top_pages": [
    { "page_url": "/products/camiseta-azul", "sessions": 145 }
  ],
  "ts": "2026-05-05T23:00:00.000Z"
}
```

### 5c. Agendar o resumo diário

Para envio automático diário, configure um nó **Cron** no n8n para chamar:

```
POST https://SUA-API.com/api/webhook/n8n
Content-Type: application/json

{ "action": "daily_summary" }
```

---

## 6. Configurações avançadas do snippet

Você pode personalizar o snippet passando parâmetros adicionais:

```liquid
{% render 'shopify-analytics',
  api_url:        'https://SUA-API.com',
  mouse_interval: 300,
  batch_interval: 2000,
  batch_size:     20
%}
```

| Parâmetro       | Padrão | Descrição                                       |
|-----------------|--------|-------------------------------------------------|
| `api_url`       | `http://localhost:3001` | URL da API de analytics        |
| `mouse_interval`| `500`  | Intervalo de captura do mouse (ms)              |
| `batch_interval`| `3000` | Frequência de envio dos eventos (ms)            |
| `batch_size`    | `15`   | Número de eventos por requisição                |

---

## 7. Dados coletados

| Evento       | Dados                                                    |
|--------------|----------------------------------------------------------|
| `page_view`  | URL, device, resolução, viewport, timestamp              |
| `click`      | X/Y absoluto, elemento CSS, texto do elemento            |
| `scroll`     | Profundidade atingida (25 / 50 / 75 / 100%)              |
| `mouse_move` | X/Y amostrado a cada 500ms                               |
| `page_exit`  | Tempo total na página                                    |

---

## 8. Estrutura de arquivos

```
shopify-analytics/
├── package.json            ← npm run dev inicia tudo
├── backend/
│   ├── server.js           ← Express + CORS
│   ├── db.js               ← SQLite (analytics.db gerado automaticamente)
│   └── routes/
│       ├── events.js       ← POST /api/events
│       ├── heatmap.js      ← GET  /api/heatmap
│       ├── sessions.js     ← GET  /api/sessions, /api/sessions/:id
│       ├── funnel.js       ← GET  /api/funnel
│       ├── scrollDepth.js  ← GET  /api/scroll-depth
│       └── webhook.js      ← POST /api/webhook/*
├── dashboard/
│   └── src/
│       ├── App.jsx          ← Layout principal + navegação
│       └── components/
│           ├── Heatmap.jsx        ← Canvas heat map
│           ├── ScrollDepth.jsx    ← Gráfico de barras
│           ├── Funnel.jsx         ← Funil de conversão
│           ├── Sessions.jsx       ← Tabela de sessões
│           ├── SessionReplay.jsx  ← Replay de mouse
│           └── Filters.jsx        ← Filtros globais
└── shopify/
    └── analytics.liquid    ← Snippet para o tema
```

---

## 9. Solução de problemas

**API não inicia:**
```bash
cd backend && npm install
```

**Erro de CORS na loja Shopify:**
- Verifique se a URL em `api_url` está correta e acessível publicamente
- O servidor aceita origens `*.myshopify.com` e `*.shopify.com` por padrão

**Dados não aparecem no dashboard:**
- Confirme que a API está rodando: `curl http://localhost:3001/api/health`
- Verifique o Network tab no browser da loja para erros na requisição `/api/events`

**Banco de dados:**
```bash
# Localização: backend/analytics.db
# Visualizar com qualquer cliente SQLite, ex.:
npx @databases/sqlite-cli backend/analytics.db
```
