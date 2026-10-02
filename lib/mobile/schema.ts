import type { DatabaseSync } from 'node:sqlite';

export function initializeMobile(database:DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS mobile_pairs (
      id TEXT PRIMARY KEY, challenge TEXT NOT NULL, label TEXT NOT NULL, code TEXT NOT NULL,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, approved_email TEXT,
      consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mobile_devices (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, email TEXT NOT NULL, secret_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0,
      fcm_token TEXT, token_updated_at INTEGER, last_test INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mobile_push_outbox (
      id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES mobile_devices(id),
      event_id INTEGER REFERENCES pokemon_events(id), payload TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, next_attempt INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER NOT NULL DEFAULT 0, error TEXT, sent_at INTEGER,
      UNIQUE(device_id,event_id)
    );
    CREATE INDEX IF NOT EXISTS mobile_push_due ON mobile_push_outbox(state,next_attempt);
  `);
}
