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
    CREATE TABLE IF NOT EXISTS notification_preferences (
      email TEXT PRIMARY KEY REFERENCES dashboard_users(email),quiet_enabled INTEGER NOT NULL DEFAULT 0 CHECK(quiet_enabled IN (0,1)),
      quiet_start INTEGER NOT NULL DEFAULT 1320 CHECK(quiet_start BETWEEN 0 AND 1439),quiet_end INTEGER NOT NULL DEFAULT 480 CHECK(quiet_end BETWEEN 0 AND 1439),
      digest_minutes INTEGER NOT NULL DEFAULT 0 CHECK(digest_minutes IN (0,5,10)),watchlist_only INTEGER NOT NULL DEFAULT 0 CHECK(watchlist_only IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS pokemon_watch_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL REFERENCES dashboard_users(email),query TEXT NOT NULL,
      shop_id TEXT REFERENCES pokemon_shops(id),language TEXT NOT NULL CHECK(language IN ('any','english','japanese')),max_huf INTEGER CHECK(max_huf BETWEEN 1 AND 10000000)
    );
    CREATE INDEX IF NOT EXISTS pokemon_watch_owner ON pokemon_watch_rules(email);
  `);
  const deviceColumns=new Set((database.prepare('PRAGMA table_info(mobile_devices)').all() as {name:string}[]).map(column=>column.name));
  if(!deviceColumns.has('device_type'))database.exec("ALTER TABLE mobile_devices ADD COLUMN device_type TEXT NOT NULL DEFAULT 'android' CHECK(device_type IN ('android','browser'))");
  database.exec("CREATE INDEX IF NOT EXISTS mobile_devices_fcm_token ON mobile_devices(fcm_token) WHERE fcm_token IS NOT NULL");
}
