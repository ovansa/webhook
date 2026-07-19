import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { BinStore, DEFAULT_BIN_ID } from './store.js';
import { openDatabase } from './db.js';
import { captureRawBody, tryParse, type RawBodyRequest } from './parse.js';
import type { CapturedRequest, CapturedResponse, ResponseConfig } from './types.js';

// The built React UI lives in ../public relative to dist/server.js.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');
const HAS_UI = existsSync(INDEX_HTML);

const PORT = Number(process.env.PORT) || 3000;
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS) || 200;
// SQLite file that persists bins + captured requests across restarts.
// Set DB_FILE=:memory: to run without persistence.
const DB_FILE = process.env.DB_FILE ?? path.resolve(__dirname, '..', 'data', 'webhook.db');
// Optional token. If set, the UI/API require ?token=... (or X-Auth-Token header).
// The capture endpoints stay open so real webhooks can be delivered.
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';

const db = openDatabase(DB_FILE);
const store = new BinStore(MAX_REQUESTS, db);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // honor X-Forwarded-For behind a reverse proxy / VPS

// --- Auth for UI/API (NOT for the capture endpoints) ---------------------
function requireToken(req: Request, res: Response, next: NextFunction): void {
  if (!AUTH_TOKEN) return next();
  const provided = req.query.token ?? req.get('X-Auth-Token');
  if (provided === AUTH_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized. Provide ?token= or X-Auth-Token header.' });
}

// --- Health check --------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ ok: true, stored: store.totalRequests });
});

// --- Bin management API --------------------------------------------------
app.get('/api/bins', requireToken, (_req, res) => {
  res.json({ bins: store.listBins() });
});

app.post('/api/bins', requireToken, captureRawBody, (req: RawBodyRequest, res) => {
  // Accept an optional { name } JSON body.
  let name: string | undefined;
  try {
    const parsed = JSON.parse((req.rawBody ?? Buffer.alloc(0)).toString('utf8') || '{}');
    if (parsed && typeof parsed.name === 'string') name = parsed.name;
  } catch {
    // ignore — name is optional
  }
  const bin = store.createBin(name);
  res.status(201).json(bin);
});

app.delete('/api/bins/:binId', requireToken, (req, res) => {
  const removed = store.deleteBin(req.params.binId);
  if (!removed) {
    res.status(400).json({ error: 'Cannot delete this bin (unknown or default).' });
    return;
  }
  res.json({ ok: true, deleted: req.params.binId });
});

// Configure the response a bin sends to every incoming webhook.
app.patch(
  '/api/bins/:binId/response',
  requireToken,
  captureRawBody,
  (req: RawBodyRequest, res) => {
    if (!store.hasBin(req.params.binId)) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }
    let raw: unknown = {};
    try {
      raw = JSON.parse((req.rawBody ?? Buffer.alloc(0)).toString('utf8') || '{}');
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    const base = store.responseConfig(req.params.binId);
    const bin = store.setResponseConfig(req.params.binId, parseResponseConfig(raw, base));
    res.json(bin);
  },
);

// --- Request inspection API (scoped to a bin) ----------------------------
app.get('/api/bins/:binId/requests', requireToken, (req, res) => {
  const items = store.requests(req.params.binId);
  if (!items) {
    res.status(404).json({ error: 'Bin not found' });
    return;
  }
  res.json({ binId: req.params.binId, count: items.length, requests: items });
});

app.get('/api/bins/:binId/requests/:id', requireToken, (req, res) => {
  const found = store.findRequest(req.params.binId, req.params.id);
  if (!found) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(found);
});

app.delete('/api/bins/:binId/requests', requireToken, (req, res) => {
  const existed = store.clearBin(req.params.binId);
  if (!existed) {
    res.status(404).json({ error: 'Bin not found' });
    return;
  }
  res.json({ ok: true, cleared: req.params.binId });
});

// --- Web UI (built React SPA served from ../public) ----------------------
// Static assets (JS/CSS/fonts) are served openly so the app can load; the
// SPA's own API calls are still token-gated by requireToken above.
if (HAS_UI) {
  app.use(express.static(PUBLIC_DIR, { index: false }));
  // The app shell at "/" is token-gated so a bare public URL doesn't reveal it.
  app.get('/', requireToken, (_req, res) => {
    res.sendFile(INDEX_HTML);
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text')
      .send('Webhook Inspector API is running. UI not built (run the web build).');
  });
}

// --- Capture: bin-scoped -------------------------------------------------
// /b/:binId/anything  -> captured under that bin.
app.all('/b/:binId/*', captureRawBody, (req: RawBodyRequest, res: Response) => {
  const binId = req.params.binId;
  // The captured path is everything after /b/:binId
  const capturedPath = '/' + (req.params[0] ?? '');
  capture(binId, capturedPath, req, res);
});
// Allow hitting the bin root exactly: /b/:binId
app.all('/b/:binId', captureRawBody, (req: RawBodyRequest, res: Response) => {
  capture(req.params.binId, '/', req, res);
});

// --- Capture: legacy global catch-all -> default bin ---------------------
app.all('/*', captureRawBody, (req: RawBodyRequest, res: Response) => {
  // Browsers auto-request /favicon.ico when the UI loads; don't record that
  // noise in the default bin. (Bin-scoped webhooks always hit /b/:id/… above.)
  if (req.path === '/favicon.ico') {
    res.status(204).end();
    return;
  }
  capture(DEFAULT_BIN_ID, req.path, req, res);
});

/** Shared capture logic: record the request + the response we send back. */
function capture(binId: string, capturedPath: string, req: RawBodyRequest, res: Response): void {
  const raw = req.rawBody ?? Buffer.alloc(0);
  const { parsed, text } = tryParse(raw, req.get('content-type') ?? '');
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // --- Compute the configurable response, so you can test how your sender
  //     reacts. The bin's stored responseConfig is the base; per-request query
  //     params override it for one-offs. Recorded on the entry AND sent back. -
  //   ?status=201             -> respond with 201
  //   ?status=500&delay=800   -> respond 500 after 800ms
  //   ?body=<url-encoded>     -> respond with a custom body (raw passthrough)
  //   ?contentType=text/plain -> override the response content-type
  const cfg = store.responseConfig(binId);
  const status =
    req.query.status !== undefined ? clampStatus(req.query.status) : cfg.statusCode;
  const delay =
    req.query.delay !== undefined
      ? Math.min(Number(req.query.delay) || 0, 10_000)
      : cfg.delayMs;
  const queryBody = typeof req.query.body === 'string' ? req.query.body : null;
  const queryType = typeof req.query.contentType === 'string' ? req.query.contentType : null;

  // Body precedence: query ?body= > bin's configured body > default JSON ack.
  const effectiveBody = queryBody ?? cfg.body;
  const contentType = queryType ?? cfg.contentType;

  const response: CapturedResponse =
    effectiveBody !== null
      ? {
          statusCode: status,
          contentType: withCharset(contentType),
          body: effectiveBody,
          delayMs: delay,
        }
      : {
          statusCode: status,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ ok: true, id, binId, received: timestamp }),
          delayMs: delay,
        };

  const entry: CapturedRequest = {
    id,
    binId,
    timestamp,
    method: req.method,
    path: capturedPath,
    query: req.query as Record<string, unknown>,
    headers: req.headers,
    ip: req.ip,
    size: raw.length,
    truncated: Boolean(req.bodyTruncated),
    contentType: req.get('content-type') ?? null,
    body: text,
    json: parsed,
    response,
  };
  store.add(binId, entry);

  const send = (): void => {
    res.status(response.statusCode).type(response.contentType).send(response.body);
  };
  if (delay > 0) setTimeout(send, delay);
  else send();
}

/** Clamp an incoming ?status= value to a valid HTTP status, default 200. */
function clampStatus(raw: unknown): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 100 && n <= 599) return n;
  return 200;
}

/** Ensure a content-type carries a charset so text renders correctly. */
function withCharset(contentType: string): string {
  if (/charset=/i.test(contentType)) return contentType;
  return `${contentType}; charset=utf-8`;
}

/** Validate + normalize a partial response config from the API. */
function parseResponseConfig(raw: unknown, base: ResponseConfig): ResponseConfig {
  const b = (raw ?? {}) as Record<string, unknown>;
  const next: ResponseConfig = { ...base };
  if (b.statusCode !== undefined) next.statusCode = clampStatus(b.statusCode);
  if (typeof b.contentType === 'string' && b.contentType.trim())
    next.contentType = b.contentType.trim();
  if (b.body === null || typeof b.body === 'string') next.body = b.body;
  if (b.delayMs !== undefined)
    next.delayMs = Math.min(Math.max(Number(b.delayMs) || 0, 0), 10_000);
  return next;
}

const server = app.listen(PORT, () => {
  console.log(`Webhook inspector listening on :${PORT}`);
  console.log(`Persisting to ${DB_FILE}`);
  console.log(
    AUTH_TOKEN
      ? 'UI/API protected by AUTH_TOKEN.'
      : 'WARNING: no AUTH_TOKEN set — UI/API are public.',
  );
});

// Flush and close the database cleanly on shutdown.
function shutdown(signal: string): void {
  console.log(`\n${signal} received — closing database and shutting down.`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
