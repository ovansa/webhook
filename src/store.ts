import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_RESPONSE_CONFIG,
  type Bin,
  type CapturedRequest,
  type ResponseConfig,
} from './types.js';

/** A single bin: metadata, its response config, and a newest-first ring buffer. */
interface BinRecord {
  id: string;
  name: string | null;
  createdAt: string;
  responseConfig: ResponseConfig;
  items: CapturedRequest[];
}

/** The bin id used when a request hits the legacy global catch-all. */
export const DEFAULT_BIN_ID = 'default';

/**
 * SQLite-backed store of named bins (endpoints), each holding a ring buffer of
 * captured requests. Newest first; oldest dropped once `max` is exceeded.
 *
 * The database is the source of truth and is loaded into an in-memory cache on
 * startup; every mutation writes through to disk so bins, their response
 * configs, and captured requests all survive restarts. Reads serve the cache,
 * keeping the live-polling hot path fast.
 */
export class BinStore {
  private bins = new Map<string, BinRecord>();

  constructor(
    private readonly max: number,
    private readonly db: DatabaseSync,
  ) {
    this.hydrate();
    // Ensure the default bin always exists (first run, or a wiped db).
    if (!this.bins.has(DEFAULT_BIN_ID)) {
      const record: BinRecord = {
        id: DEFAULT_BIN_ID,
        name: 'Default',
        createdAt: new Date().toISOString(),
        responseConfig: { ...DEFAULT_RESPONSE_CONFIG },
        items: [],
      };
      this.bins.set(DEFAULT_BIN_ID, record);
      this.insertBin(record);
    }
  }

  /** Load all bins and their (capped) requests from disk into the cache. */
  private hydrate(): void {
    const binRows = this.db
      .prepare('SELECT id, name, created_at, response_config FROM bins')
      .all() as Array<{
      id: string;
      name: string | null;
      created_at: string;
      response_config: string;
    }>;

    for (const row of binRows) {
      this.bins.set(row.id, {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        responseConfig: parseConfig(row.response_config),
        items: [],
      });
    }

    // Newest-first, capped at `max` per bin.
    const reqRows = this.db
      .prepare('SELECT bin_id, data FROM requests ORDER BY timestamp ASC')
      .all() as Array<{ bin_id: string; data: string }>;

    for (const row of reqRows) {
      const bin = this.bins.get(row.bin_id);
      if (!bin) continue;
      bin.items.unshift(JSON.parse(row.data) as CapturedRequest);
      if (bin.items.length > this.max) bin.items.length = this.max;
    }
  }

  /** Create a new bin with a random id. */
  createBin(name?: string): Bin {
    const id = crypto.randomBytes(6).toString('base64url'); // short, URL-safe
    const record: BinRecord = {
      id,
      name: name?.trim() || null,
      createdAt: new Date().toISOString(),
      responseConfig: { ...DEFAULT_RESPONSE_CONFIG },
      items: [],
    };
    this.bins.set(id, record);
    this.insertBin(record);
    return this.toBin(record);
  }

  hasBin(id: string): boolean {
    return this.bins.has(id);
  }

  listBins(): Bin[] {
    return [...this.bins.values()]
      .map((b) => this.toBin(b))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Delete a bin (except the default one). Returns whether it was removed. */
  deleteBin(id: string): boolean {
    if (id === DEFAULT_BIN_ID) return false;
    if (!this.bins.delete(id)) return false;
    // ON DELETE CASCADE removes the bin's requests too.
    this.db.prepare('DELETE FROM bins WHERE id = ?').run(id);
    return true;
  }

  /** The response config a bin sends (falls back to the built-in default). */
  responseConfig(binId: string): ResponseConfig {
    return this.bins.get(binId)?.responseConfig ?? { ...DEFAULT_RESPONSE_CONFIG };
  }

  /** Update a bin's response config. Returns the updated bin, or undefined. */
  setResponseConfig(binId: string, cfg: ResponseConfig): Bin | undefined {
    const bin = this.bins.get(binId);
    if (!bin) return undefined;
    bin.responseConfig = cfg;
    this.db
      .prepare('UPDATE bins SET response_config = ? WHERE id = ?')
      .run(JSON.stringify(cfg), binId);
    return this.toBin(bin);
  }

  /** Add a request to a bin, creating the bin on demand if it doesn't exist. */
  add(binId: string, entry: CapturedRequest): void {
    let bin = this.bins.get(binId);
    if (!bin) {
      bin = {
        id: binId,
        name: null,
        createdAt: new Date().toISOString(),
        responseConfig: { ...DEFAULT_RESPONSE_CONFIG },
        items: [],
      };
      this.bins.set(binId, bin);
      this.insertBin(bin);
    }

    bin.items.unshift(entry);
    this.db
      .prepare('INSERT INTO requests (id, bin_id, timestamp, data) VALUES (?, ?, ?, ?)')
      .run(entry.id, binId, entry.timestamp, JSON.stringify(entry));

    // Enforce the ring-buffer cap in memory and on disk.
    if (bin.items.length > this.max) {
      const dropped = bin.items.splice(this.max);
      const del = this.db.prepare('DELETE FROM requests WHERE id = ?');
      for (const r of dropped) del.run(r.id);
    }
  }

  /** All requests in a bin (newest first), or undefined if the bin is unknown. */
  requests(binId: string): CapturedRequest[] | undefined {
    return this.bins.get(binId)?.items;
  }

  findRequest(binId: string, requestId: string): CapturedRequest | undefined {
    return this.bins.get(binId)?.items.find((r) => r.id === requestId);
  }

  /** Clear a bin's requests. Returns whether the bin existed. */
  clearBin(binId: string): boolean {
    const bin = this.bins.get(binId);
    if (!bin) return false;
    bin.items.length = 0;
    this.db.prepare('DELETE FROM requests WHERE bin_id = ?').run(binId);
    return true;
  }

  get totalRequests(): number {
    let n = 0;
    for (const b of this.bins.values()) n += b.items.length;
    return n;
  }

  private insertBin(b: BinRecord): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO bins (id, name, created_at, response_config) VALUES (?, ?, ?, ?)',
      )
      .run(b.id, b.name, b.createdAt, JSON.stringify(b.responseConfig));
  }

  private toBin(b: BinRecord): Bin {
    return {
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      requestCount: b.items.length,
      responseConfig: b.responseConfig,
    };
  }
}

function parseConfig(json: string): ResponseConfig {
  try {
    return { ...DEFAULT_RESPONSE_CONFIG, ...(JSON.parse(json) as ResponseConfig) };
  } catch {
    return { ...DEFAULT_RESPONSE_CONFIG };
  }
}
