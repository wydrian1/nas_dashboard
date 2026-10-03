import type { DatabaseSync } from 'node:sqlite';
export function initializeOpenCode(database:DatabaseSync) {
  database.exec(`CREATE TABLE IF NOT EXISTS opencode_access_families (
    id_hash TEXT PRIMARY KEY,email TEXT NOT NULL REFERENCES dashboard_users(email),
    device_id TEXT REFERENCES mobile_devices(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1))
  );`);
}
