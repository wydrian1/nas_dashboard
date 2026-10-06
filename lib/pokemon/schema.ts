import type { DatabaseSync } from "node:sqlite";
import { GAMERUNNER_URL, MYTHGAMES_URL, POTTYOSZEBRA_URL, GRANDLINE_URL, KRODOMCARDS_URL, JATEKNET_URL, REFLEXSHOP_URL, GEEKEMPIRE_URL, TCGFUTAR_URL, SPORTKARTYABOLT_URL, RTCOLLECTORSCLUB_URL, CARDVERSE_URL, METAGAMES_URL } from "./types.ts";
import { migratePokemonIntervals } from './interval-migration.ts';

export function initializePokemon(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS pokemon_shops (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      interval_minutes INTEGER NOT NULL DEFAULT 3 CHECK(interval_minutes BETWEEN 3 AND 60),
      notify_new INTEGER NOT NULL DEFAULT 1, notify_restock INTEGER NOT NULL DEFAULT 1,
      notify_preorder INTEGER NOT NULL DEFAULT 1,
      emails_enabled INTEGER NOT NULL DEFAULT 0,
      baseline_at INTEGER, last_success INTEGER, next_scan INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, manual_requested INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'idle', last_error TEXT, last_count INTEGER NOT NULL DEFAULT 0,
      pending_drop TEXT, failure_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pokemon_products (
      shop_id TEXT NOT NULL REFERENCES pokemon_shops(id), external_id TEXT NOT NULL,
      sku TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, image TEXT, price_huf INTEGER,
      availability TEXT NOT NULL, in_stock INTEGER NOT NULL, missing_count INTEGER NOT NULL DEFAULT 0,
      episode INTEGER NOT NULL DEFAULT 1, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      last_queued INTEGER, PRIMARY KEY(shop_id,external_id)
    );
    CREATE TABLE IF NOT EXISTS pokemon_scans (
      id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER NOT NULL,
      status TEXT NOT NULL, product_count INTEGER, pages INTEGER, error TEXT
    );
    CREATE TABLE IF NOT EXISTS pokemon_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id TEXT NOT NULL, shop_id TEXT NOT NULL,
      external_id TEXT NOT NULL, episode INTEGER NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, url TEXT NOT NULL, price_huf INTEGER, occurred_at INTEGER NOT NULL,
      mail_state TEXT NOT NULL DEFAULT 'not_requested',
      UNIQUE(shop_id,external_id,episode)
    );
    CREATE TABLE IF NOT EXISTS pokemon_mail_outbox (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER NOT NULL DEFAULT 0, error TEXT, created_at INTEGER NOT NULL,
      sent_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS pokemon_worker (
      id INTEGER PRIMARY KEY CHECK(id=1), heartbeat INTEGER NOT NULL, message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pokemon_events_time ON pokemon_events(occurred_at DESC);
    CREATE TABLE IF NOT EXISTS pokemon_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
  `);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('gamerunner','GameRunner',?)").run(GAMERUNNER_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('mythgames','MythGames',?)").run(MYTHGAMES_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('pottyoszebra','Pöttyös Zebra',?)").run(POTTYOSZEBRA_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('grandline','GrandLine',?)").run(GRANDLINE_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('krodomcards','Krodom Cards',?)").run(KRODOMCARDS_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('jateknet','JátékNet',?)").run(JATEKNET_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('reflexshop','Reflexshop',?)").run(REFLEXSHOP_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('geekempire','GeekEmpire',?)").run(GEEKEMPIRE_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('tcgfutar','TCG Futár',?)").run(TCGFUTAR_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('sportkartyabolt','Sport Kártya Bolt',?)").run(SPORTKARTYABOLT_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('rtcollectorsclub','RT Collectors Club',?)").run(RTCOLLECTORSCLUB_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('cardverse','Cardverse',?)").run(CARDVERSE_URL);
  database.prepare("INSERT OR IGNORE INTO pokemon_shops(id,name,url) VALUES('metagames','Metagames',?)").run(METAGAMES_URL);
  migratePokemonIntervals(database);
  // One-time, non-destructive retirement. Historical rows remain; no SMTP sender exists.
  if(!database.prepare("SELECT 1 FROM pokemon_migrations WHERE id='retire-email-v1'").get()){
    database.exec('BEGIN IMMEDIATE');
    try{
      database.exec("UPDATE pokemon_shops SET emails_enabled=0; UPDATE pokemon_mail_outbox SET state='cancelled' WHERE state IN ('queued','retry'); UPDATE pokemon_events SET mail_state='cancelled' WHERE mail_state='queued' AND scan_id IN (SELECT id FROM pokemon_mail_outbox WHERE state='cancelled');");
      database.prepare("INSERT OR IGNORE INTO pokemon_migrations VALUES('retire-email-v1',?)").run(Date.now());
      database.exec('COMMIT');
    }catch(error){database.exec('ROLLBACK');throw error;}
  }
}
