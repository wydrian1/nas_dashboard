import type { DatabaseSync } from 'node:sqlite';
export function initializeDatabase(database: DatabaseSync) {
  database.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS players(email TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)));
    CREATE TABLE IF NOT EXISTS adventure_saves(owner TEXT PRIMARY KEY,state_json TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=0),updated_at TEXT NOT NULL);
  `);
}
