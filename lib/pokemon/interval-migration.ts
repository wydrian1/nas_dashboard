import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_SCAN_INTERVAL_MINUTES, MIN_SCAN_INTERVAL_MINUTES, MAX_SCAN_INTERVAL_MINUTES } from './types.ts';

export const THREE_MINUTE_MIGRATION='three-minute-intervals-v1';
const legacyInterval=/interval_minutes\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+10\s+CHECK\s*\(\s*interval_minutes\s+BETWEEN\s+5\s+AND\s+60\s*\)/i;
const currentInterval=/interval_minutes\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+3\s+CHECK\s*\(\s*interval_minutes\s+BETWEEN\s+3\s+AND\s+60\s*\)/i;
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';

// One owner-requested update, not a reset of settings on each startup. SQLite
// cannot widen a CHECK in place: use its create/copy/drop/rename migration with
// foreign keys temporarily off outside the transaction, never writable_schema.
export function migratePokemonIntervals(database:DatabaseSync,now=Date.now()) {
  const applied=()=>!!database.prepare('SELECT 1 FROM pokemon_migrations WHERE id=?').get(THREE_MINUTE_MIGRATION);
  if(applied())return;
  if(database.isTransaction)throw new Error('A Pokémon-intervallum migráció önálló tranzakciót igényel.');
  const foreignKeys=Number(database.prepare('PRAGMA foreign_keys').get()!.foreign_keys);
  database.exec('PRAGMA foreign_keys=OFF');
  try{
    database.exec('BEGIN IMMEDIATE');
    // Another dashboard/worker may have completed the same migration while we waited.
    if(applied()){database.exec('COMMIT');return;}
    const sql=database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pokemon_shops'").get()?.sql as string|undefined;
    if(!sql || (!legacyInterval.test(sql) && !currentInterval.test(sql)))throw new Error('Ismeretlen Pokémon-intervallum séma; nem módosítjuk az adatokat.');
    if(legacyInterval.test(sql)){
      const header=/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:pokemon_shops|"pokemon_shops"|`pokemon_shops`|\[pokemon_shops\])\s*\(/i;
      if(!header.test(sql))throw new Error('Nem felismerhető Pokémon-webshop tábla.');
      const replacement=sql.replace(header,'CREATE TABLE pokemon_shops_interval_v2 (').replace(legacyInterval,`interval_minutes INTEGER NOT NULL DEFAULT ${DEFAULT_SCAN_INTERVAL_MINUTES} CHECK(interval_minutes BETWEEN ${MIN_SCAN_INTERVAL_MINUTES} AND ${MAX_SCAN_INTERVAL_MINUTES})`);
      const attached=database.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='pokemon_shops' AND type IN ('index','trigger') AND sql IS NOT NULL ORDER BY type,name").all() as {sql:string}[];
      const columns=(database.prepare('PRAGMA table_info(pokemon_shops)').all() as {name:string}[]).map(row=>quote(row.name));
      database.exec(replacement);
      database.exec(`INSERT INTO pokemon_shops_interval_v2(rowid,${columns.join(',')}) SELECT rowid,${columns.join(',')} FROM pokemon_shops; DROP TABLE pokemon_shops; ALTER TABLE pokemon_shops_interval_v2 RENAME TO pokemon_shops;`);
      for(const item of attached)database.exec(item.sql);
    }
    database.prepare(`UPDATE pokemon_shops SET interval_minutes=?,next_scan=CASE
      WHEN enabled=1 AND failure_count=0 AND lease_owner IS NULL AND lease_until<=? AND manual_requested=0 AND status IN ('idle','ok','warning')
      THEN MIN(next_scan,COALESCE(last_success,?)+?) ELSE next_scan END`).run(DEFAULT_SCAN_INTERVAL_MINUTES,now,now,DEFAULT_SCAN_INTERVAL_MINUTES*60_000);
    database.prepare('INSERT INTO pokemon_migrations(id,applied_at) VALUES(?,?)').run(THREE_MINUTE_MIGRATION,now);
    if(database.prepare('PRAGMA foreign_key_check').all().length)throw new Error('A Pokémon-intervallum migráció idegenkulcs-ellenőrzése sikertelen.');
    database.exec('COMMIT');
  }catch(error){if(database.isTransaction)database.exec('ROLLBACK');throw error;}
  finally{database.exec(`PRAGMA foreign_keys=${foreignKeys ? 'ON' : 'OFF'}`);}
}
