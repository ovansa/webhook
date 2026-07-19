import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Opens (creating if needed) the SQLite database that persists bins and their
 * captured requests. Uses Node's built-in node:sqlite — no external dependency.
 *
 * Durability over throughput: this app writes only a handful of rows per webhook,
 * so we prioritise never losing data over write speed. We deliberately do NOT use
 * WAL mode here — WAL defers writes into a separate -wal file that is only folded
 * into the main database on a checkpoint or clean close. Under `tsx watch` + Ctrl+C
 * (and other abrupt exits) the process can die before that checkpoint runs, which
 * is how saved URLs were disappearing on restart. Plain rollback-journal mode with
 * synchronous=FULL commits each transaction straight into the .db file with an
 * fsync, so data survives even a hard kill.
 */
export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') {
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = DELETE'); // no separate WAL file to lose
  db.exec('PRAGMA synchronous = FULL'); // fsync each commit
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bins (
      id             TEXT PRIMARY KEY,
      name           TEXT,
      created_at     TEXT NOT NULL,
      response_config TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id          TEXT PRIMARY KEY,
      bin_id      TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
      timestamp   TEXT NOT NULL,
      -- The full CapturedRequest serialized as JSON. Kept whole so the shape
      -- can evolve without a schema migration; columns above are for indexing.
      data        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_bin_time
      ON requests (bin_id, timestamp DESC);
  `);
}
