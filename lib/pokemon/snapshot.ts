import type { DatabaseSync } from "node:sqlite";
import { plainSqlRow } from "../sql-rows.ts";
import { shop } from "./store.ts";
import { SHOP_IDS } from "./types.ts";
import type { PokemonSnapshot, StoredProduct, PokemonEvent, PokemonAggregateEvent } from "./types.ts";
import { notificationSettings } from './notifications.ts';
import type { Role } from '../users.ts';

export function readPokemonSnapshot(database:DatabaseSync,_legacySmtpConfigured=false,now=Date.now(),viewer?:{email:string;role:Role}):PokemonSnapshot {
  const recentSince=now-24*60*60_000;
  const worker=database.prepare('SELECT heartbeat FROM pokemon_worker WHERE id=1').get() as {heartbeat:number}|undefined;
  const shops=SHOP_IDS.map(shopID=>({
    shop:shop(database,shopID),
    ...(viewer ? {notifications:notificationSettings(database,viewer.email,shopID)} : {}),
    products:(database.prepare('SELECT * FROM pokemon_products WHERE shop_id=? AND in_stock=1 ORDER BY title LIMIT 600').all(shopID) as StoredProduct[]).map(plainSqlRow),
    events:(database.prepare(`SELECT e.* FROM pokemon_events e
      JOIN pokemon_products p ON p.shop_id=e.shop_id AND p.external_id=e.external_id
        AND p.in_stock=1 AND p.missing_count=0 AND p.episode=e.episode
      WHERE e.shop_id=? AND e.occurred_at>? AND e.occurred_at<=?
      ORDER BY e.occurred_at DESC,e.id DESC LIMIT 30`).all(shopID,recentSince,now) as PokemonEvent[]).map(plainSqlRow),
    mail:[] // Deprecated API field; historical mail is preserved only in SQLite.
  }));
  // Filter before the global limit: current availability episodes, visible for less than 24 hours.
  // One accepted missing scan hides the card; confirmed restock detection still needs two missing scans.
  const latestEvents=(database.prepare(`SELECT e.*,s.name AS shop_name,p.image FROM pokemon_events e
    JOIN pokemon_shops s ON s.id=e.shop_id
    JOIN pokemon_products p ON p.shop_id=e.shop_id AND p.external_id=e.external_id
      AND p.in_stock=1 AND p.missing_count=0 AND p.episode=e.episode
    WHERE e.occurred_at>? AND e.occurred_at<=?
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT 60`).all(recentSince,now) as PokemonAggregateEvent[]).map(plainSqlRow);
  return {...shops[0],shops,latestEvents,...(viewer ? {viewerRole:viewer.role} : {}),workerAlive:!!worker && now-worker.heartbeat<4*60_000,smtpConfigured:false};
}
