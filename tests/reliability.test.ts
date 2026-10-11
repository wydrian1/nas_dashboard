import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeDatabase} from '../lib/db-schema.ts';
import {shop,claimScan,failScan} from '../lib/pokemon/store.ts';
import {shopHealth,interruptionRedirect} from '../lib/pokemon/health.ts';
import {shopFetchUrl,ShopRequestError} from '../lib/pokemon/fetch-policy.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {deliveryPreferences,quietNow,productPushDue,watchMatches,watchRules,saveDeliveryPreferences,addWatchRule,deleteWatchRule} from '../lib/mobile/preferences.ts';
import {notificationAllowed} from '../lib/pokemon/notifications.ts';
import {queuePushEvent} from '../lib/mobile/store.ts';
import {sendNextPush} from '../lib/mobile/push.ts';
import {pushHistory} from '../lib/mobile/history.ts';
import {globalSearch} from '../lib/global-search.ts';
import {backupHealth,operationalHealth} from '../lib/operational-health.ts';
import {valuationQuality} from '../lib/finance/valuation-quality.ts';

process.env.ALLOWED_EMAIL='owner@example.test';
const owner='owner@example.test',other='other@example.test',reader='reader@example.test',info='info@example.test',now=Date.UTC(2026,9,11,12,1);
function fixture(run:(db:DatabaseSync)=>void){const db=new DatabaseSync(':memory:');initializeDatabase(db);try{run(db);}finally{db.close();}}
function users(db:DatabaseSync){for(const [email,role]of [[other,'admin'],[reader,'pokemon-reader'],[info,'info-reader']])db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,?,?)').run(email,role,now,now);}
function device(db:DatabaseSync,id='owner-device',email=owner){db.prepare('INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES(?,?,?,?,?,?,?,1,?)').run(id,'Synthetic phone',email,id+'-secret-hash',now,now+86400000,now,'synthetic-fcm-token-'+id);}
function event(db:DatabaseSync,title='English Booster Box',price:number|null=5000,shopID='gamerunner'){
  const external='fixture-'+Number(db.prepare('SELECT count(*) n FROM pokemon_events').get()!.n);
  return Number(db.prepare("INSERT INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,price_huf,occurred_at,mail_state) VALUES('fixture',?,?,1,'new',?,?,?,?,'not_requested')").run(shopID,external,title,'https://gamerunner.hu/product',price,now).lastInsertRowid);
}
const form=(values:Record<string,string>)=>{const result=new FormData();for(const [key,value]of Object.entries(values))result.set(key,value);return result;};

test('shop freshness never presents paused, failed, warning, missing-heartbeat or old scans as current',()=>fixture(db=>{
  const current=shop(db);current.last_success=now;current.baseline_at=now;
  assert.equal(shopHealth(current,true,now).stale,false);
  for(const value of [{...current,enabled:0},{...current,failure_count:1},{...current,status:'warning'},{...current,last_success:null},{...current,last_success:now-16*60_000},{...current,last_success:now+120000}])assert.equal(shopHealth(value,true,now).stale,true);
  assert.equal(shopHealth(current,false,now).stale,true);assert.equal(shopHealth({...current,interval_minutes:8,last_success:now-20*60_000},true,now).stale,false);
}));
test('known interruption redirects are classified without widening the fetch allowlist or crossing origins',()=>{
  assert.equal(interruptionRedirect(new URL('https://www.grandline.hu/hozzaferesi-vedelem/')),'protected');
  assert.equal(interruptionRedirect(new URL('https://www.krodomcards.hu/index.php?route=common/maintenance')),'maintenance');
  for(const url of ['https://example.com/hozzaferesi-vedelem/','https://user:pass@www.grandline.hu/hozzaferesi-vedelem/','https://www.grandline.hu/pokemon/'])assert.equal(interruptionRedirect(new URL(url)),null);
  assert.throws(()=>shopFetchUrl('https://www.grandline.hu/hozzaferesi-vedelem/'));assert.throws(()=>shopFetchUrl('https://www.krodomcards.hu/index.php?route=common/maintenance'));
  assert.equal(new ShopRequestError('fixture',60000,'rate_limited').kind,'rate_limited');
});
test('maintenance failures retain stock and enforce the existing retry/backoff floor; snapshots flag stale events',()=>fixture(db=>{
  const id=event(db);db.prepare("INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,price_huf,availability,in_stock,first_seen,last_seen) VALUES('gamerunner','fixture-0','','English Booster Box','https://gamerunner.hu/product',5000,'in_stock',1,?,?)").run(now,now);
  db.prepare("UPDATE pokemon_shops SET last_success=?,baseline_at=? WHERE id='gamerunner'").run(now,now);db.prepare("INSERT INTO pokemon_worker VALUES(1,?,'running')").run(now);
  const lease=claimScan(db,now)!;failScan(db,lease,'Karbantartás',0,now+1,'maintenance');
  assert.equal(shop(db).status,'maintenance');assert.ok(shop(db).next_scan>=now+15*60_000);assert.equal(db.prepare('SELECT in_stock FROM pokemon_products').get()!.in_stock,1);
  const snapshot=readPokemonSnapshot(db,false,now+1);assert.equal(snapshot.shops[0].health!.stale,true);assert.equal(snapshot.latestEvents.find(item=>item.id===id)!.stale,true);
}));
test('additive preference migration preserves users, paired devices, notes, balances and shop settings; defaults do not restrict pushes',()=>fixture(db=>{
  users(db);device(db);db.exec("INSERT INTO notes(title,content) VALUES('Existing','Keep');UPDATE pokemon_shops SET interval_minutes=8 WHERE id='mythgames';DROP TABLE pokemon_watch_rules;DROP TABLE notification_preferences;");
  const tables=['dashboard_users','mobile_devices','notes','finance_balances','pokemon_shops'];const before=tables.map(table=>JSON.stringify(db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()));
  initializeDatabase(db);initializeDatabase(db);
  assert.deepEqual(tables.map(table=>JSON.stringify(db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all())),before);
  assert.equal(deliveryPreferences(db,owner).digest_minutes,0);assert.equal(deliveryPreferences(db,owner).quiet_enabled,0);assert.equal(deliveryPreferences(db,owner).watchlist_only,0);assert.equal(notificationAllowed(db,owner,event(db)),true);
}));
test('quiet hours use Budapest DST and exclusive end time; default scheduling remains immediate',()=>fixture(db=>{
  const preferences={...deliveryPreferences(db,owner),quiet_enabled:1};
  assert.equal(quietNow(preferences,Date.UTC(2026,9,25,0,30)),true);assert.equal(quietNow(preferences,Date.UTC(2026,9,25,1,30)),true);
  assert.equal(quietNow(preferences,Date.UTC(2026,9,25,7,0)),false);assert.equal(quietNow(preferences,now),false);
  assert.equal(productPushDue(deliveryPreferences(db,owner),now),now);assert.equal(productPushDue({...preferences,digest_minutes:5},now),Date.UTC(2026,9,11,12,5));
}));
test('watch rules are literal, conjunctive per rule and disjunctive across rules, with no guessed language or price',()=>fixture(db=>{
  addWatchRule(db,owner,form({query:'booster box',shop_id:'gamerunner',language:'english',max_huf:'5000'}));const rule=watchRules(db,owner)[0];
  assert.equal(watchMatches(rule,{shop_id:'gamerunner',title:'ANGOL Booster Box',price_huf:5000}),true);
  for(const value of [{shop_id:'mythgames',title:'English Booster Box',price_huf:1000},{shop_id:'gamerunner',title:'Booster Box',price_huf:1000},{shop_id:'gamerunner',title:'English Booster Box',price_huf:null},{shop_id:'gamerunner',title:'English Booster Box',price_huf:5001}])assert.equal(watchMatches(rule,value),false);
  assert.equal(notificationAllowed(db,owner,event(db,'Unrelated Tin')),true); // Rule is opt-in, not automatic.
  db.prepare('INSERT INTO notification_preferences(email,watchlist_only) VALUES(?,1)').run(owner);
  assert.equal(notificationAllowed(db,owner,event(db,'Unrelated Tin')),false);assert.equal(notificationAllowed(db,owner,event(db)),true);
  addWatchRule(db,owner,form({query:'tin',shop_id:'',language:'any',max_huf:''}));assert.equal(notificationAllowed(db,owner,event(db,'Unrelated Tin')),true);
}));
test('watchlist ownership, reader permissions, malformed input and limits cannot bypass access rules',()=>fixture(db=>{
  users(db);addWatchRule(db,other,form({query:'secret',shop_id:'',language:'any',max_huf:''}));const id=watchRules(db,other)[0].id;
  deleteWatchRule(db,owner,String(id));assert.equal(watchRules(db,other).length,1);
  for(const email of [info,'unknown@example.test'])assert.throws(()=>addWatchRule(db,email,form({query:'box',shop_id:'',language:'any',max_huf:''})));
  for(const value of [{query:'',shop_id:'',language:'any',max_huf:''},{query:'box',shop_id:'private-host',language:'any',max_huf:''},{query:'box',shop_id:'',language:'unknown',max_huf:''},{query:'box',shop_id:'',language:'any',max_huf:'-1'}])assert.throws(()=>addWatchRule(db,owner,form(value)));
  for(let i=0;i<30;i++)addWatchRule(db,owner,form({query:'box '+i,shop_id:'',language:'any',max_huf:''}));assert.throws(()=>addWatchRule(db,owner,form({query:'extra',shop_id:'',language:'any',max_huf:''})));
}));
test('changing personal settings cancels only that account’s pending product pushes, not tasks or another user',()=>fixture(db=>{
  users(db);device(db);device(db,'other-device',other);const id=event(db);queuePushEvent(db,id,'gamerunner','Box','new',5000,now);
  db.prepare("INSERT INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES('task','owner-device','{}',?,?)").run(now,now+10000);
  saveDeliveryPreferences(db,owner,form({quiet_start:'22:00',quiet_end:'08:00',digest_minutes:'5'}));
  assert.equal(db.prepare('SELECT state FROM mobile_push_outbox WHERE event_id=? AND device_id=?').get(id,'owner-device')!.state,'cancelled');assert.equal(db.prepare('SELECT state FROM mobile_push_outbox WHERE event_id=? AND device_id=?').get(id,'other-device')!.state,'queued');assert.equal(db.prepare("SELECT state FROM mobile_push_outbox WHERE id='task'").get()!.state,'queued');
}));
test('quiet product arrivals are recorded muted, never sent or caught up as stale notifications',()=>fixture(db=>{
  device(db);db.prepare('INSERT INTO notification_preferences(email,quiet_enabled) VALUES(?,1)').run(owner);const id=event(db);
  queuePushEvent(db,id,'gamerunner','Box','new',5000,Date.UTC(2026,9,11,21,0));assert.equal(pushHistory(db,owner)[0].state,'muted');
}));
test('push history contains only own device records and no tokens, secrets, raw payloads or other accounts',()=>fixture(db=>{
  users(db);device(db);device(db,'other-device',other);const id=event(db);queuePushEvent(db,id,'gamerunner','Box','new',5000,now);
  const history=pushHistory(db,owner);assert.equal(history.length,1);assert.equal(history[0].title,'English Booster Box');assert.doesNotMatch(JSON.stringify(history),/fcm|secret-hash|other-device|productUrl/);assert.throws(()=>pushHistory(db,info));
}));
async function digestFixture(run:(db:DatabaseSync)=>Promise<void>){const db=new DatabaseSync(':memory:');initializeDatabase(db);device(db);db.prepare('INSERT INTO notification_preferences(email,digest_minutes) VALUES(?,5)').run(owner);try{for(const title of ['English Box A','English Box B']){const id=event(db,title);queuePushEvent(db,id,'gamerunner',title,'new',5000,now);}await run(db);}finally{db.close();}}
test('summary mode waits for a bucket boundary, sends one existing-APK-compatible summary and atomically marks all member rows',async()=>digestFixture(async db=>{
  let calls=0;const deliver=async(_token:string,payload:Record<string,string>,_ttl?:number,authorized?:()=>boolean)=>{calls++;assert.equal(payload.kind,'digest');assert.equal(payload.path,'/pokemon');assert.match(payload.body,/Box A/);assert.match(payload.body,/Box B/);assert.ok(payload.eventId.length<=80);assert.equal(authorized!(),true);return {state:'sent' as const};};
  await sendNextPush(db,{configured:true,now,deliver});assert.equal(calls,0);
  await sendNextPush(db,{configured:true,now:now+4*60_000,deliver});assert.equal(calls,1);assert.deepEqual(db.prepare('SELECT state,attempts FROM mobile_push_outbox').all().map(row=>[row.state,row.attempts]),[['sent',1],['sent',1]]);
}));
test('uncertain summary results never resend any member event automatically',async()=>digestFixture(async db=>{
  let calls=0;const deliver=async()=>{calls++;return {state:'uncertain' as const};};await sendNextPush(db,{configured:true,now:now+4*60_000,deliver});await sendNextPush(db,{configured:true,now:now+5*60_000,deliver});assert.equal(calls,1);assert.ok(db.prepare('SELECT state FROM mobile_push_outbox').all().every(row=>row.state==='uncertain'));
}));
test('summary authorization is rechecked after asynchronous OAuth and cancels if a current rule no longer permits members',async()=>digestFixture(async db=>{
  await sendNextPush(db,{configured:true,now:now+4*60_000,deliver:async(_token,_payload,_ttl,authorized)=>{db.prepare('UPDATE notification_preferences SET watchlist_only=1 WHERE email=?').run(owner);assert.equal(authorized!(),false);return {state:'cancelled'};}});assert.ok(db.prepare('SELECT state FROM mobile_push_outbox').all().every(row=>row.state==='cancelled'));
}));
test('global search restricts modules by actual DB role, scopes tasks, excludes deleted/uploading content and escapes LIKE wildcards',()=>fixture(db=>{
  users(db);db.prepare("INSERT INTO notes(title,content) VALUES('Lantern note','<script>not executable</script>'),('Literal %_ record','safe')").run();
  db.prepare('INSERT INTO important_info VALUES(1,?,1,?)').run('<p>Lantern notice</p>',new Date(now).toISOString());
  db.prepare("INSERT INTO hosted_entries(id,name,name_key,kind,state,actor,created_at) VALUES('a','Lantern file','lantern','file','ready',?,?)").run(owner,now);
  db.prepare("INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,availability,in_stock,first_seen,last_seen) VALUES('gamerunner','x','','Lantern box','https://gamerunner.hu/x','in_stock',1,?,?)").run(now,now);
  assert.deepEqual(new Set(globalSearch(db,owner,'lantern').map(row=>row.kind)),new Set(['Jegyzet','Fájl','Fontos infók','Készletfigyelő']));
  assert.deepEqual(globalSearch(db,reader,'lantern').map(row=>row.kind),['Készletfigyelő']);assert.deepEqual(globalSearch(db,info,'lantern').map(row=>row.kind),['Fontos infók']);assert.throws(()=>globalSearch(db,'unknown@example.test','lantern'));
  assert.equal(globalSearch(db,owner,'%_').length,1);assert.equal(globalSearch(db,owner,'x').length,0);assert.equal(globalSearch(db,owner,'x'.repeat(81)).length,0);
  assert.ok(globalSearch(db,owner,'lantern').every(row=>row.href.startsWith('/')&&!row.href.startsWith('//')));
}));
test('owner-only operational summary does not expose secrets or pretend unavailable backup evidence succeeded',()=>fixture(db=>{
  users(db);assert.throws(()=>operationalHealth(db,other));assert.throws(()=>operationalHealth(db,reader));
  const result=operationalHealth(db,owner,'nonexistent-fixture-root',now);assert.equal(result.backup.state,'unknown');assert.equal(result.workerAlive,false);assert.doesNotMatch(JSON.stringify(result),/secret|fcm_token|email|\.env|private_key/i);
}));
test('backup health distinguishes missing, failed, stale, future and unverified evidence from a full verified restore',()=>{
  const stamp=new Date(now-3600000).toISOString(),status={state:'success',archive:'fixture.nasbackup',localRestoreVerified:true,cloudVerified:true},receipt={archive:status.archive,sha256:'a'.repeat(64),createdAt:stamp,restoreVerifiedAt:stamp,cloudVerifiedAt:stamp},restore={verifiedAt:stamp,sqliteIntegrityVerified:true,productionUntouched:true,authenticatedDecryptionVerified:true,downloadedSha256Verified:true,standaloneRecoveryKitVerified:true,manifestFilesVerified:1};
  assert.equal(backupHealth(status,receipt,restore,now).state,'ok');assert.equal(backupHealth(null,null,null,now).state,'unknown');
  for(const args of [[{...status,state:'failed'},receipt,restore],[status,{...receipt,cloudVerifiedAt:null},restore],[status,receipt,{...restore,sqliteIntegrityVerified:false}],[status,{...receipt,createdAt:new Date(now-37*3600000).toISOString()},restore],[status,receipt,{...restore,verifiedAt:new Date(now+86400000).toISOString()}],[status,{...receipt,archive:'other.nasbackup'},restore],[status,receipt,{...restore,downloadedSha256Verified:false}]])assert.equal(backupHealth(...args as [unknown,unknown,unknown],now).state,'warning');
});
test('valuation metadata shows missing-date units and costs without treating genuine zero costs as missing or changing inventory',()=>{
  const items=[{quantity:3,unit_price_minor:5000,acquired_on:null},{quantity:2,unit_price_minor:0,acquired_on:'2026-01-01'}],before=JSON.stringify(items),result=valuationQuality(items,new Date(now-1000).toISOString(),now);
  assert.equal(result.unknownDateUnits,3);assert.equal(result.unknownDateCostMinor,15000);assert.equal(result.zeroCostRows,1);assert.equal(result.sourceState,'recent');assert.equal(JSON.stringify(items),before);assert.equal(valuationQuality(items,new Date(now-25*3600000).toISOString(),now).sourceState,'stale');assert.equal(valuationQuality(items,null,now).sourceState,'missing');
});
