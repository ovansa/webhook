# Webhook Inspector

A small, reliable self-hosted webhook request inspector — like webhook.site, but
you own it, so nothing external can take it down. Written in TypeScript.

- **Multiple webhook URLs (bins)** — create as many distinct endpoints as you want;
  each collects its own requests. Create new ones or reuse existing ones.
- Catches **any HTTP method** on **any path** and records method, headers, query,
  raw + parsed body, IP, and timestamp.
- **Live web UI** (React, auto-refreshing) at `/` to browse captured requests, with
  a bin selector, one-click "New URL", and copy-to-clipboard endpoint URLs.
- **Configurable responses** to test how your sender reacts — status codes, delays,
  custom bodies.
- **JSON API** for programmatic inspection.
- **Persistent storage (SQLite)** — bins, response configs, and captured requests
  survive restarts. Uses Node's built-in `node:sqlite` (no external dependency).
  Keeps the last `MAX_REQUESTS` (default 200) per bin.
- Token-protected UI/API; the capture endpoint stays open for real webhooks.

> Requires **Node.js 22+** (for the built-in `node:sqlite` module).

## Project layout

```
src/        Express + TypeScript API and capture server  → builds to dist/
web/        React + Vite + Tailwind v4 frontend           → builds to public/
```

The server serves the built UI from `public/` in production, so it's a single
process on one port.

## Run locally

Two terminals during development (the Vite dev server proxies `/api` to Express):

```bash
# terminal 1 — API server (hot reload)
npm install
npm run dev

# terminal 2 — UI dev server (hot reload) at http://localhost:5173
cd web && npm install && npm run dev
```

Or run the production build as one process:

```bash
npm install && npm run build          # build the server
cd web && npm install && npm run build # build the UI into ../public
cd .. && npm start                     # serves API + UI on :3000
```

Open http://localhost:3000/ (add `?token=...` if `AUTH_TOKEN` is set).

## Configurable responses

Every captured request records **the response the inspector sent back** (status,
content-type, body), shown in the detail panel alongside the request — request and
response bodies are pretty-printed when they're JSON.

There are two ways to control the response, useful for testing services that depend
on what the webhook endpoint returns:

**1. Per-bin default (persistent).** Configure a bin once — in the UI via
"Configure response", or via the API — and it applies to every request to that bin:

```bash
PATCH /api/bins/:binId/response
  { "statusCode": 202,
    "contentType": "application/json",
    "body": "{\"received\":true}",   # null = default JSON ack
    "delayMs": 0 }
```

**2. Per-request query params (one-off override).** These override the bin default
for a single request:

| Param         | Effect                                          | Example                          |
| ------------- | ----------------------------------------------- | -------------------------------- |
| `status`      | Respond with this HTTP status (100–599)         | `/b/ID/hook?status=201`          |
| `delay`       | Delay the response in ms (max 10000)            | `/b/ID/hook?status=500&delay=800`|
| `body`        | Respond with a custom (URL-encoded) body        | `/b/ID/hook?body=pong`           |
| `contentType` | Override the response content-type              | `/b/ID/hook?body=ok&contentType=text/plain` |

```bash
curl "http://localhost:3000/b/ID/hook?status=500"          # simulate a failing receiver
curl "http://localhost:3000/b/ID/hook?status=201&delay=2000"  # slow 201
```

## Webhook URLs (bins)

Each **bin** is a separate endpoint with its own captured requests.

- Send webhooks to `POST /b/<binId>/<any/path>` — captured under that bin.
- Requests to any other path fall into the `default` bin (backward compatible).
- Create/manage bins in the UI ("+ New URL") or via the API below.

```bash
GET    /api/bins                       # list bins (with request counts)
POST   /api/bins    {"name":"stripe"}  # create a bin -> { id, name, ... }
DELETE /api/bins/:binId                # delete a bin (not the default one)
PATCH  /api/bins/:binId/response       # set the bin's default response (see above)
```

## Inspection API

```bash
GET    /api/bins/:binId/requests       # list a bin's requests (newest first)
GET    /api/bins/:binId/requests/:id   # one request
DELETE /api/bins/:binId/requests       # clear a bin
GET    /health                         # health check
```

All except `/health` and the capture endpoints require the token when `AUTH_TOKEN`
is set (`?token=...` or `X-Auth-Token` header).

## Deploy to a VPS

```bash
# On the server, with Docker installed:
AUTH_TOKEN=your-secret docker compose up -d --build
```

Then front it with your reverse proxy (Caddy/nginx) for TLS, e.g. Caddy:

```
webhooks.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Point your webhook sender at `https://webhooks.yourdomain.com/anything`, and open
`https://webhooks.yourdomain.com/?token=your-secret` to watch requests live.

The `docker-compose.yml` mounts a named volume at `/app/data`, so the SQLite
database (and everything in it) persists across restarts and redeploys.

## Persistence

Data is stored in a SQLite file at `DB_FILE` (default `data/webhook.db`, or
`/app/data/webhook.db` in Docker). Bins, their response configs, and captured
requests are all persisted and reloaded on startup. Set `DB_FILE=:memory:` to run
without persistence (data lost on restart).

## Config (env vars)

| Var            | Default            | Meaning                                        |
| -------------- | ------------------ | ---------------------------------------------- |
| `PORT`         | `3000`             | Listen port                                    |
| `MAX_REQUESTS` | `200`              | How many requests to keep per bin              |
| `AUTH_TOKEN`   | *(none)*           | Protects UI/API. Unset = public. **Set this in production.** |
| `DB_FILE`      | `data/webhook.db`  | SQLite database path. `:memory:` disables persistence. |
