import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase } from '../lib/db-schema.ts';
import { ownerEmail, roleFor, requireAccess, setUserRole, initializeUsers, homeForRole, canAccess } from '../lib/users.ts';
import { verifiedProfileEmail } from '../lib/access.ts';
import { notificationSettings, saveNotifications } from '../lib/pokemon/notifications.ts';
import { startPair, approvePair, exchangePair, deviceBySecret, deviceAuthorized, updateDevice, registerBrowserPush, opaque, digest } from '../lib/mobile/store.ts';
import { claimScan, finishScan } from '../lib/pokemon/store.ts';
import { sendNextPush } from '../lib/mobile/push.ts';
import { readPokemonSnapshot } from '../lib/pokemon/snapshot.ts';
import type { PokemonProduct } from '../lib/pokemon/types.ts';

const owner=ownerEmail(),reader='reader@example.com',other='other-reader@example.com';
function database(){const db=new DatabaseSync(':memory:');initializeDatabase(db);setUserRole(db,owner,reader,'pokemon-reader',true,1);setUserRole(db,owner,other,'pokemon-reader',true,1);return db;}
function phone(db:DatabaseSync,email:string,now=1000){
  const verifier=opaque(),pair=startPair(db,digest(verifier),email+' phone',now);approvePair(db,pair.id,email,now+1);
  const result=exchangePair(db,pair.id,verifier,now+2)!;const device=deviceBySecret(db,result.secret,now+3);
  updateDevice(db,device,'test-fcm-token-'+opaque(),true,now+4);return {...result,device};
}
const base:PokemonProduct={externalID:'base',sku:'',title:'Base',url:'https://gamerunner.hu/base',image:null,priceHuf:1000,availability:'in_stock'};
function scan(db:DatabaseSync,products:PokemonProduct[],now:number,shop='gamerunner'){
  db.prepare('UPDATE pokemon_shops SET next_scan=0 WHERE id=?').run(shop);
  finishScan(db,claimScan(db,now,shop as 'gamerunner')!,{products,total:products.length,pages:1,scannedAt:now},now+1);
}

test('Roles: unknown/unverified Google profiles get no access; owner stays admin and readers only get Pokemon/APK/self-mobile',()=>{
  const db=database();try{
    assert.equal(verifiedProfileEmail({email:reader,email_verified:false}),null);
    assert.equal(verifiedProfileEmail({email:reader,email_verified:true}),reader);
    assert.equal(roleFor(db,'unknown@example.com'),null);assert.equal(roleFor(db,owner.toUpperCase()),'admin');
    for(const feature of ['admin','pokemon','apk','mobile-self'] as const)assert.equal(requireAccess(db,owner,feature),'admin');
    for(const feature of ['pokemon','apk','mobile-self'] as const)assert.equal(requireAccess(db,reader,feature),'pokemon-reader');
    assert.throws(()=>requireAccess(db,reader,'admin'));assert.throws(()=>requireAccess(db,'unknown@example.com','pokemon'));
  }finally{db.close();}
});
test('Roles: nullpont-player reaches only the game handoff and gets no NAS or mobile access',()=>{
  const db=database(),player='player@example.com';try{
    setUserRole(db,owner,player,'nullpont-player',true,1);
    assert.equal(roleFor(db,player),'nullpont-player');assert.equal(homeForRole('nullpont-player'),'/adventure');
    for(const feature of ['admin','pokemon','important-info','apk','mobile-self'] as const)assert.equal(canAccess('nullpont-player',feature),false);
    for(const feature of ['admin','pokemon','important-info','apk','mobile-self'] as const)assert.throws(()=>requireAccess(db,player,feature));
    const verifier=opaque(),pair=startPair(db,digest(verifier),'Game',1000);
    assert.throws(()=>approvePair(db,pair.id,player,1001));
    assert.throws(()=>registerBrowserPush(db,player,'test-fcm-token-'+opaque()));
  }finally{db.close();}
});
test('Roles: readers cannot manage roles; owner cannot be demoted/disabled; changes are audited and reinitialization preserves membership',()=>{
  const db=database();try{
    assert.throws(()=>setUserRole(db,reader,other,'admin',true));assert.throws(()=>setUserRole(db,owner,owner,'pokemon-reader',true));assert.throws(()=>setUserRole(db,owner,owner,'admin',false));
    assert.throws(()=>setUserRole(db,owner,'x@example.com','super-admin',true));
    setUserRole(db,owner,reader,'admin',true);assert.equal(roleFor(db,reader),'admin');
    assert.throws(()=>setUserRole(db,reader,reader,'pokemon-reader',true));
    setUserRole(db,owner,reader,'pokemon-reader',true);initializeDatabase(db);assert.equal(roleFor(db,reader),'pokemon-reader');
    assert.equal(db.prepare('SELECT count(*) AS n FROM user_role_audit').get()!.n,4);
  }finally{db.close();}
});
test('Roles: original admin notification selections migrate once without changing baseline/shared shop configuration',()=>{
  const db=database();try{
    db.exec(`DELETE FROM pokemon_user_notifications; UPDATE pokemon_shops SET notify_new=0,notify_preorder=0,baseline_at=123,interval_minutes=25 WHERE id='gamerunner'`);
    initializeUsers(db);assert.deepEqual(notificationSettings(db,owner,'gamerunner'),{enabled:1,notify_new:0,notify_restock:1,notify_preorder:0});
    saveNotifications(db,owner,'gamerunner',false,{notify_new:1,notify_restock:0,notify_preorder:1});initializeUsers(db);
    assert.deepEqual(notificationSettings(db,owner,'gamerunner'),{enabled:0,notify_new:1,notify_restock:0,notify_preorder:1});
    assert.equal(db.prepare("SELECT baseline_at FROM pokemon_shops WHERE id='gamerunner'").get()!.baseline_at,123);
    assert.deepEqual(notificationSettings(db,reader,'gamerunner'),{enabled:1,notify_new:1,notify_restock:1,notify_preorder:1});
  }finally{db.close();}
});
test('Roles: each account receives independent new events; owner opt-out does not suppress either reader',()=>{
  const db=database();try{
    const adminPhone=phone(db,owner),a=phone(db,reader,2000),b=phone(db,other,3000);
    saveNotifications(db,owner,'gamerunner',false);
    scan(db,[base],4000);scan(db,[base,{...base,externalID:'new'}],700_000);
    const jobs=db.prepare('SELECT device_id FROM mobile_push_outbox ORDER BY device_id').all().map(row=>row.device_id);
    assert.deepEqual(jobs,[a.deviceId,b.deviceId].sort());assert.ok(!jobs.includes(adminPhone.deviceId));
    assert.equal(readPokemonSnapshot(db,false,700_002,{email:owner,role:'admin'}).notifications!.enabled,0);
    assert.equal(readPokemonSnapshot(db,false,700_002,{email:reader,role:'pokemon-reader'}).notifications!.enabled,1);
  }finally{db.close();}
});
test('Roles: reader opt-out cancels only their pending shop pushes across their own phones, not other accounts/shops',()=>{
  const db=database();try{
    phone(db,owner);const a=phone(db,reader,2000),a2=phone(db,reader,3000),b=phone(db,other,4000);
    scan(db,[base],5000);scan(db,[base,{...base,externalID:'new'}],700_000);
    scan(db,[base],5000,'mythgames');scan(db,[base,{...base,externalID:'new'}],700_000,'mythgames');
    const before=db.prepare('SELECT * FROM pokemon_shops ORDER BY id').all();
    saveNotifications(db,reader,'gamerunner',false,{notify_new:0,notify_restock:0,notify_preorder:0});
    assert.deepEqual(db.prepare('SELECT * FROM pokemon_shops ORDER BY id').all(),before);
    assert.deepEqual(notificationSettings(db,reader,'gamerunner'),{enabled:0,notify_new:1,notify_restock:1,notify_preorder:1});
    const state=(id:string,shop:string)=>db.prepare('SELECT o.state FROM mobile_push_outbox o JOIN pokemon_events e ON e.id=o.event_id WHERE o.device_id=? AND e.shop_id=?').get(id,shop)!.state;
    assert.equal(state(a.deviceId,'gamerunner'),'cancelled');assert.equal(state(a2.deviceId,'gamerunner'),'cancelled');
    assert.equal(state(b.deviceId,'gamerunner'),'queued');assert.equal(state(a.deviceId,'mythgames'),'queued');
    // Re-enabling does not enqueue historical events.
    const n=db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n;saveNotifications(db,reader,'gamerunner',true);
    assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,n);
  }finally{db.close();}
});
test('Roles: disabled account immediately loses native/WebView access and queued pushes; other users remain unaffected',()=>{
  const db=database();try{
    const a=phone(db,reader),b=phone(db,other,2000);scan(db,[base],3000);scan(db,[base,{...base,externalID:'new'}],700_000);
    setUserRole(db,owner,reader,'pokemon-reader',false);
    assert.equal(roleFor(db,reader),null);assert.throws(()=>deviceBySecret(db,a.secret,700_002));assert.equal(deviceAuthorized(db,a.deviceId,reader,700_002),false);
    assert.equal(deviceAuthorized(db,b.deviceId,other,700_002),true);
    assert.equal(db.prepare('SELECT state FROM mobile_push_outbox WHERE device_id=?').get(a.deviceId)!.state,'cancelled');
    assert.equal(db.prepare('SELECT state FROM mobile_push_outbox WHERE device_id=?').get(b.deviceId)!.state,'queued');
    setUserRole(db,owner,reader,'pokemon-reader',true);assert.throws(()=>deviceBySecret(db,a.secret,700_003));
  }finally{db.close();}
});
test('Roles: paired reader bearer belongs to that account and approval cannot be stolen or exchanged after disabling',()=>{
  const db=database();try{
    const verifier=opaque(),pair=startPair(db,digest(verifier),'Reader',1000);approvePair(db,pair.id,reader,1001);
    assert.throws(()=>approvePair(db,pair.id,other,1002));
    const result=exchangePair(db,pair.id,verifier,1003)!;assert.equal(deviceBySecret(db,result.secret,1004).email,reader);
    assert.equal(deviceAuthorized(db,result.deviceId,other,1004),false);
    const next=opaque(),pending=startPair(db,digest(next),'Next',2000);approvePair(db,pending.id,reader,2001);
    setUserRole(db,owner,reader,'pokemon-reader',false);assert.throws(()=>exchangePair(db,pending.id,next,2002));
  }finally{db.close();}
});
test('Roles: pending submissions recheck role and personal notification preference before FCM',async()=>{
  const db=database();try{
    const a=phone(db,reader);scan(db,[base],2000);scan(db,[base,{...base,externalID:'new'}],700_000);
    // Simulate a preference update racing the worker without calling the usual cancellation helper.
    db.prepare('INSERT INTO pokemon_user_notifications(email,shop_id,enabled) VALUES(?,?,0)').run(reader,'gamerunner');
    await sendNextPush(db,{configured:true,now:700_003,deliver:async()=>{throw new Error('Must not send opted-out notification');}});
    assert.equal(db.prepare('SELECT state FROM mobile_push_outbox WHERE device_id=?').get(a.deviceId)!.state,'cancelled');
  }finally{db.close();}
});
test('Roles: reader receives all event kinds when opted in, including after demotion from admin with restrictive old categories',()=>{
  const db=database();try{
    phone(db,reader);setUserRole(db,owner,reader,'admin',true);
    saveNotifications(db,reader,'gamerunner',true,{notify_new:0,notify_restock:0,notify_preorder:0});
    setUserRole(db,owner,reader,'pokemon-reader',true);
    scan(db,[base],2000);scan(db,[base,{...base,externalID:'preorder',availability:'preorder'}],700_000);
    assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,1);
  }finally{db.close();}
});
test('Roles: device quota is per account, not shared with the admin',()=>{
  const db=database();try{
    for(let i=0;i<10;i++)phone(db,owner,1000+i*100000);
    assert.throws(()=>phone(db,owner,1_100_000));
    assert.equal(phone(db,reader,1_200_000).device.email,reader);
  }finally{db.close();}
});
