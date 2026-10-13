import type { DatabaseSync } from "node:sqlite";
import { initializePokemon } from "./pokemon/schema.ts";
import { initializeMobile } from "./mobile/schema.ts";
import { initializeUsers } from "./users.ts";
import { initializeFinance } from "./finance/schema.ts";
import { initializeOpenCode } from './opencode-schema.ts';
import { initializeTaskReminders } from './mobile/task-reminders.ts';

export type Feed = { id: number; name: string; url: string; article_limit: number; checked_at: string | null; error: string | null };
export type Article = { id: number; title: string; url: string; published: string | null; image_url: string | null; is_read: number; feed_name: string };

export function initializeDatabase(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
      article_limit INTEGER NOT NULL DEFAULT 20 CHECK(article_limit BETWEEN 1 AND 100),
      checked_at TEXT, error TEXT
    );
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY, feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, published TEXT, image_url TEXT,
      seen_at TEXT, source_position INTEGER NOT NULL DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0, UNIQUE(feed_id, guid)
    );
    CREATE TABLE IF NOT EXISTS quick_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS weather_location (
      id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL,
      latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
      longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180)
    );
    CREATE TABLE IF NOT EXISTS important_info (
      id INTEGER PRIMARY KEY CHECK(id=1),html TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS important_info_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,before_html TEXT NOT NULL,after_html TEXT NOT NULL,
      revision INTEGER NOT NULL,occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS adventure_saves (
      owner TEXT PRIMARY KEY, state_json TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0), updated_at TEXT NOT NULL
    );
  `);
  initializePokemon(database);
  initializeMobile(database);
  initializeUsers(database);
  initializeTaskReminders(database);
  initializeFinance(database);
  initializeOpenCode(database);
  initializeFileHosting(database);
  const columns = (table: string) => (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(column => column.name);
  const needsLimit = !columns("feeds").includes("article_limit");
  const needsImage = !columns("articles").includes("image_url");
  const needsSeen = !columns("articles").includes("seen_at");
  const needsPosition = !columns("articles").includes("source_position");
  if (needsLimit || needsImage || needsSeen || needsPosition) {
    database.exec("BEGIN IMMEDIATE");
    try {
      if (needsLimit) database.exec("ALTER TABLE feeds ADD COLUMN article_limit INTEGER NOT NULL DEFAULT 20 CHECK(article_limit BETWEEN 1 AND 100)");
      if (needsImage) database.exec("ALTER TABLE articles ADD COLUMN image_url TEXT");
      if (needsSeen) database.exec("ALTER TABLE articles ADD COLUMN seen_at TEXT");
      if (needsPosition) database.exec("ALTER TABLE articles ADD COLUMN source_position INTEGER NOT NULL DEFAULT 0");
      // Refresh existing feeds on their next visit to backfill enclosure images.
      database.exec("UPDATE feeds SET checked_at=NULL; COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
  }
}

// Kept self-contained so immutable Pokemon worker snapshots gain no new imports.
export function initializeFileHosting(database:DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS hosted_entries (
      id TEXT PRIMARY KEY, parent_id TEXT REFERENCES hosted_entries(id),
      name TEXT NOT NULL, name_key TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('file','folder')),
      state TEXT NOT NULL CHECK(state IN ('uploading','ready')), size INTEGER NOT NULL DEFAULT 0 CHECK(size>=0),
      sha256 TEXT, actor TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS hosted_entry_names ON hosted_entries(COALESCE(parent_id,''),name_key);
    CREATE TABLE IF NOT EXISTS hosted_links (
      id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES hosted_entries(id),
      expires_at INTEGER, revoked_at INTEGER, actor TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hosted_links_file ON hosted_links(file_id);
    CREATE TABLE IF NOT EXISTS hosted_audit (
      id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
      entry_id TEXT NOT NULL, detail_json TEXT NOT NULL, occurred_at INTEGER NOT NULL
    );
  `);
}

export const ARTICLE_QUERY = `
  SELECT * FROM (
    SELECT a.*, f.name AS feed_name, f.article_limit,
      ROW_NUMBER() OVER (PARTITION BY a.feed_id ORDER BY COALESCE(a.published, '') DESC,
        COALESCE(a.seen_at, '') DESC, a.source_position ASC, a.id DESC) AS feed_rank
    FROM articles a JOIN feeds f ON f.id=a.feed_id
  ) WHERE feed_rank <= article_limit
  ORDER BY COALESCE(published, '') DESC, COALESCE(seen_at, '') DESC, source_position ASC, id DESC
`;
