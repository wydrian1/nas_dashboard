import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {initializeDatabase} from '../lib/db-schema.ts';
import {migratePokemonIntervals,THREE_MINUTE_MIGRATION} from '../lib/pokemon/interval-migration.ts';
import {validScanInterval,SHOP_IDS} from '../lib/pokemon/types.ts';
import {claimScan,finishScan,failScan,shop} from '../lib/pokemon/store.ts';
import {parseGamerunnerPage} from '../lib/pokemon/adapters/gamerunner.ts';
import {registerTestPhone} from './helpers/push.ts';

const products=parseGamerunnerPage(readFileSync(new URL('./fixtures/pokemon/gamerunner/available.html',import.meta.url),'utf8')).products;
const now=1_000_000;
function legacy(){
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const sql=db.prepare("SELECT sql FROM sqlite_master WHERE name='pokemon_shops'").get()!.sql as string;
  db.exec('PRAGMA foreign_keys=OFF;BEGIN;UPDATE pokemon_shops SET interval_minutes=10');
  db.exec(sql.replace('pokemon_shops','pokemon_shops_legacy').replace('DEFAULT 3 CHECK(interval_minutes BETWEEN 3 AND 60)','DEFAULT 10 CHECK(interval_minutes BETWEEN 5 AND 60)'));
  db.exec('INSERT INTO pokemon_shops_legacy SELECT * FROM pokemon_shops;DROP TABLE pokemon_shops;ALTER TABLE pokemon_shops_legacy RENAME TO pokemon_shops;');
  db.prepare('DELETE FROM pokemon_migrations WHERE id=?').run(THREE_MINUTE_MIGRATION);
  db.exec('UPDATE pokemon_shops SET interval_minutes=10;COMMIT;PRAGMA foreign_keys=ON');
  return db;
}
test('all registered shops default to three minutes, and admin/server validation accepts only integers 3–60',()=>{
  const db=new DatabaseSync(':memory:');try{
    initializeDatabase(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM pokemon_shops WHERE interval_minutes=3').get()!.n,SHOP_IDS.length);
    for(const value of [3,4,5,60]){assert.equal(validScanInterval(value),true);db.prepare('UPDATE pokemon_shops SET interval_minutes=?').run(value);}
    for(const value of [-1,0,1,2,61,3.5,NaN,Infinity])assert.equal(validScanInterval(value),false);
    for(const value of [2,61])assert.throws(()=>db.prepare('UPDATE pokemon_shops SET interval_minutes=?').run(value),/CHECK constraint/);
    assert.match(readFileSync(new URL('../app/pokemon-actions.ts',import.meta.url),'utf8'),/if\(!validScanInterval\(interval\)\)/);
  }finally{db.close();}
});
test('legacy interval migration preserves rowids, shop state, notifications, products/history/push, custom indexes and triggers',()=>{
  const db=legacy();try{
    registerTestPhone(db);
    db.prepare('UPDATE pokemon_shops SET next_scan=? WHERE id=?').run(now,'gamerunner');
    let owner=claimScan(db,now,'gamerunner')!;finishScan(db,owner,{products:products.slice(0,2),total:2,pages:1,scannedAt:now},now+1);
    db.prepare('UPDATE pokemon_shops SET next_scan=? WHERE id=?').run(now+100,'gamerunner');
    owner=claimScan(db,now+100,'gamerunner')!;finishScan(db,owner,{products,total:3,pages:1,scannedAt:now+100},now+101);
    db.exec("UPDATE pokemon_shops SET interval_minutes=25;CREATE INDEX preserved_shop_index ON pokemon_shops(name);CREATE TRIGGER preserved_shop_trigger BEFORE UPDATE OF name ON pokemon_shops BEGIN SELECT RAISE(ABORT,'name protected');END;");
    const tables=['pokemon_products','pokemon_events','pokemon_scans','mobile_devices','mobile_push_outbox','pokemon_user_notifications'];
    const before=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
    const shops=db.prepare('SELECT rowid,* FROM pokemon_shops ORDER BY id').all();
    migratePokemonIntervals(db,now+1000);
    assert.deepEqual(db.prepare('SELECT rowid,* FROM pokemon_shops ORDER BY id').all().map(row=>({...row})),shops.map(row=>({...row,interval_minutes:3,next_scan:Math.min(Number(row.next_scan),Number(row.last_success ?? now+1000)+180_000)})));
    for(const table of tables)assert.deepEqual(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),before[table]);
    assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('preserved_shop_index','preserved_shop_trigger')").get()!.n,2);
    assert.throws(()=>db.exec("UPDATE pokemon_shops SET name='changed' WHERE id='gamerunner'"),/name protected/);
    db.exec("UPDATE pokemon_shops SET interval_minutes=7 WHERE id='gamerunner'");initializeDatabase(db);
    assert.equal(shop(db,'gamerunner').interval_minutes,7,'later owner changes are not overwritten on restart');
    db.exec("DELETE FROM pokemon_user_notifications WHERE shop_id='metagames';DELETE FROM pokemon_shops WHERE id='metagames'");initializeDatabase(db);assert.equal(shop(db,'metagames').interval_minutes,3,'future new rows use the migrated default');
  }finally{db.close();}
});
test('migration preserves error/backoff, active leases, paused and manual schedules while shortening healthy next checks',()=>{
  const db=legacy();try{
    db.prepare("UPDATE pokemon_shops SET last_success=?,next_scan=?,status='ok'").run(now-100_000,now+500_000);
    db.exec(`UPDATE pokemon_shops SET failure_count=4,status='error',last_error='429 retry',next_scan=${now+3_600_000} WHERE id='mythgames';
      UPDATE pokemon_shops SET status='scanning',lease_owner='running',lease_until=${now+300_000} WHERE id='pottyoszebra';
      UPDATE pokemon_shops SET enabled=0,status='paused' WHERE id='grandline';
      UPDATE pokemon_shops SET manual_requested=1,next_scan=0 WHERE id='krodomcards';
      UPDATE pokemon_shops SET lease_until=${now+300_000} WHERE id='jateknet';`);
    const kept=['mythgames','pottyoszebra','grandline','krodomcards','jateknet'] as const;
    const before=kept.map(id=>shop(db,id));migratePokemonIntervals(db,now);
    kept.forEach((id,index)=>assert.deepEqual(shop(db,id),{...before[index],interval_minutes:3}));
    assert.equal(shop(db,'gamerunner').next_scan,now+80_000);
  }finally{db.close();}
});
test('legacy migration rollback restores schema/data/marker/foreign-key mode on failure and fails closed on unknown schema',()=>{
  const db=legacy();try{
    db.exec("CREATE TRIGGER reject_interval BEFORE UPDATE OF interval_minutes ON pokemon_shops BEGIN SELECT RAISE(ABORT,'test failure');END;");
    const schema=db.prepare("SELECT sql FROM sqlite_master WHERE name='pokemon_shops'").get(),rows=db.prepare('SELECT * FROM pokemon_shops').all();
    assert.throws(()=>migratePokemonIntervals(db,now),/test failure/);
    assert.deepEqual(db.prepare("SELECT sql FROM sqlite_master WHERE name='pokemon_shops'").get(),schema);assert.deepEqual(db.prepare('SELECT * FROM pokemon_shops').all(),rows);
    assert.equal(db.prepare('SELECT 1 FROM pokemon_migrations WHERE id=?').get(THREE_MINUTE_MIGRATION),undefined);assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys,1);
    db.exec('DROP TRIGGER reject_interval;PRAGMA foreign_keys=OFF');migratePokemonIntervals(db,now);assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys,0);
  }finally{db.close();}
  const unknown=new DatabaseSync(':memory:');try{
    unknown.exec('CREATE TABLE pokemon_migrations(id TEXT PRIMARY KEY,applied_at INTEGER);CREATE TABLE pokemon_shops(id TEXT PRIMARY KEY,interval_minutes INTEGER DEFAULT 10);');
    assert.throws(()=>migratePokemonIntervals(unknown,now),/Ismeretlen/);assert.equal(unknown.isTransaction,false);
    unknown.exec('BEGIN');assert.throws(()=>migratePokemonIntervals(unknown,now),/önálló tranzakció/);assert.equal(unknown.isTransaction,true);unknown.exec('ROLLBACK');
  }finally{unknown.close();}
});
test('three-minute successful scans reschedule at 180 seconds and failures still respect retry/backoff',()=>{
  const db=new DatabaseSync(':memory:');try{
    initializeDatabase(db);const owner=claimScan(db,now,SHOP_IDS[0])!;finishScan(db,owner,{products,total:3,pages:1,scannedAt:now},now+1);
    assert.equal(shop(db,SHOP_IDS[0]).next_scan,now+1+180_000);
    const failed=claimScan(db,now+1+180_000,SHOP_IDS[0])!;failScan(db,failed,'rate limited',3_600_000,now+180_002);
    assert.equal(shop(db,SHOP_IDS[0]).next_scan,now+180_002+3_600_000);assert.equal(shop(db,SHOP_IDS[0]).interval_minutes,3);
  }finally{db.close();}
});
