import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase } from '../lib/db-schema.ts';
import { startPair, approvePair, exchangePair, deviceBySecret, deviceAuthorized, updateDevice, revokeDevice, registerBrowserPush,removeBrowserPush,queueTestPush, cancelShopPush, opaque, digest } from '../lib/mobile/store.ts';
import { claimPush, sendNextPush } from '../lib/mobile/push.ts';
import { mobileBody, sessionResponse } from '../lib/mobile/http.ts';
import { decode } from 'next-auth/jwt';
import { claimScan, finishScan } from '../lib/pokemon/store.ts';
import { saveNotifications } from '../lib/pokemon/notifications.ts';

const email='wydrian@gmail.com';
function database(){const db=new DatabaseSync(':memory:');initializeDatabase(db);return db;}
function paired(db:DatabaseSync,now=1000){const verifier=opaque(),pair=startPair(db,digest(verifier),'Test phone',now);approvePair(db,pair.id,email,now+1);const result=exchangePair(db,pair.id,verifier,now+2)!;return {...result,device:deviceBySecret(db,result.secret,now+3)};}
const fcm='test-FCM-token-abcdefghijklmnopqrstuvwxyz';
test('Mobile: pairing requires allowlisted approval + SHA256 verifier, is single-use and stores only hashed device secret',()=>{
  const db=database();try{
    const verifier=opaque(),pair=startPair(db,digest(verifier),'Pixel',1000);
    assert.equal(exchangePair(db,pair.id,verifier,1001),null);
    assert.throws(()=>approvePair(db,pair.id,'other@example.com',1002));
    assert.throws(()=>exchangePair(db,pair.id,opaque(),1002));
    approvePair(db,pair.id,email,1003);
    const result=exchangePair(db,pair.id,verifier,1004)!;
    assert.ok(result.secret);assert.equal(deviceBySecret(db,result.secret,1005).id,result.deviceId);
    assert.equal(db.prepare('SELECT secret_hash FROM mobile_devices').get()!.secret_hash,digest(result.secret));
    assert.throws(()=>exchangePair(db,pair.id,verifier,1006));
    assert.equal(deviceAuthorized(db,result.deviceId,'other@example.com',1006),false);
  }finally{db.close();}
});
test('Mobile: expiry, malformed challenge/label, unapproved email changes and bounded public pairing rejected',()=>{
  const db=database();try{
    assert.throws(()=>startPair(db,'bad','Pixel',1000));assert.throws(()=>startPair(db,opaque(),'\n',1000));
    const verifier=opaque(),pair=startPair(db,digest(verifier),'Pixel',1000);
    approvePair(db,pair.id,email,1001);assert.throws(()=>exchangePair(db,pair.id,verifier,301001));
    for(let n=0;n<10;n++)startPair(db,opaque(),'Phone',400000);
    assert.throws(()=>startPair(db,opaque(),'Phone',400001));
  }finally{db.close();}
});
test('Mobile: registration needs device secret; token rotation, duplicate token dedup and opt-out cancellation',()=>{
  const db=database();try{
    const a=paired(db),b=paired(db,2000);
    updateDevice(db,a.device,fcm,true,3000);queueTestPush(db,deviceBySecret(db,a.secret,4000),400000);
    updateDevice(db,b.device,fcm,true,400001);assert.equal(deviceBySecret(db,a.secret,400002).push_enabled,0);
    updateDevice(db,b.device,fcm+'new',true,400003);assert.equal(deviceBySecret(db,b.secret,400004).fcm_token,fcm+'new');
    assert.throws(()=>updateDevice(db,b.device,'bad',true));assert.throws(()=>updateDevice(db,b.device,null,true));assert.throws(()=>updateDevice(db,b.device,fcm,1));
    updateDevice(db,a.device,null,false,400005);assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()!.state,'cancelled');
  }finally{db.close();}
});
test('Browser push: authenticated subscriptions share device revocation, expiry and outbox without native secrets',()=>{
  const db=database(),token='browser-FCM-token-abcdefghijklmnopqrstuvwxyz0123456789';
  try{
    const first=registerBrowserPush(db,email,token,'Firefox',2000),same=registerBrowserPush(db,email,token,'Firefox',3000);
    assert.equal(first.id,same.id);assert.equal(db.prepare("SELECT count(*) n FROM mobile_devices WHERE device_type='browser'").get()!.n,1);
    const device=db.prepare('SELECT device_type,push_enabled,fcm_token,expires_at,secret_hash FROM mobile_devices WHERE id=?').get(first.id)!;
    assert.equal(device.device_type,'browser');assert.equal(device.push_enabled,1);assert.equal(device.fcm_token,token);assert.equal(device.expires_at,3000+90*24*60*60_000);assert.equal(typeof device.secret_hash,'string');
    assert.throws(()=>deviceBySecret(db,opaque(),4000));assert.throws(()=>updateDevice(db,device as never,token,true,4000));
    const queued=db.prepare("INSERT INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES('browser-test',?,'{}',4000,1000000)").run(first.id);
    assert.equal(queued.changes,1);assert.equal(removeBrowserPush(db,email,token,5000),true);assert.equal(db.prepare('SELECT push_enabled,fcm_token FROM mobile_devices WHERE id=?').get(first.id)!.push_enabled,0);assert.equal(db.prepare("SELECT state FROM mobile_push_outbox WHERE id='browser-test'").get()!.state,'cancelled');assert.equal(removeBrowserPush(db,email,token,6000),false);
    assert.throws(()=>registerBrowserPush(db,email,'short','Browser',7000));
  }finally{db.close();}
});
test('Mobile: revoked/expired device blocks native credential and existing WebView JWT identity immediately',()=>{
  const db=database();try{
    const a=paired(db);assert.equal(deviceAuthorized(db,a.deviceId,email,2000),true);
    assert.equal(deviceAuthorized(db,a.deviceId,email,a.expiresAt+1),false);
    revokeDevice(db,a.deviceId);assert.throws(()=>deviceBySecret(db,a.secret,2000));assert.equal(deviceAuthorized(db,a.deviceId,email,2000),false);
  }finally{db.close();}
});
test('Mobile: native WebView cookie uses Auth.js encrypted JWT, HttpOnly/Secure/SameSite, no OAuth tokens',async()=>{
  const old=process.env.AUTH_SECRET;process.env.AUTH_SECRET=opaque();const db=database();
  try{
    const a=paired(db,Date.now()),response=await sessionResponse(a.device,'admin'),cookie=response.headers.get('set-cookie')!;
    assert.ok(cookie.startsWith('__Secure-authjs.session-token='));assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);
    const jwt=await decode({token:cookie.split(';')[0].split('=')[1],secret:process.env.AUTH_SECRET,salt:'__Secure-authjs.session-token'});
    assert.equal(jwt?.mobileDeviceId,a.deviceId);assert.equal(jwt?.email,email);assert.equal(jwt?.access_token,undefined);
  }finally{db.close();if(old===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=old;}
});
test('Mobile: API rejects foreign Origin, oversized/non-JSON payload; native request needs no browser cookie',async()=>{
  assert.deepEqual(await mobileBody(new Request('https://nas.wydrian.hu/api/mobile/device',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"session"}'})),{action:'session'});
  for(const request of [new Request('https://nas.wydrian.hu/',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'}),new Request('https://nas.wydrian.hu/',{method:'POST',body:'{}'}),new Request('https://nas.wydrian.hu/',{method:'POST',headers:{'Content-Type':'application/json'},body:'"'+'a'.repeat(9000)+'"'})])await assert.rejects(mobileBody(request));
});
test('Push: silent baseline + no retroactive notifications; new/restock jobs independent from disabled email',()=>{
  const db=database();try{
    const device=paired(db);updateDevice(db,device.device,fcm,true,2000);registerBrowserPush(db,email,'browser-FCM-token-abcdefghijklmnopqrstuvwxyz0123456789','Chrome',2001);
    const product={externalID:'A',sku:'A',title:'Pokémon test',url:'https://gamerunner.hu/example',image:null,priceHuf:1000,availability:'in_stock' as const};
    const run=(products:typeof product[],now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=0 WHERE id='gamerunner'").run();const owner=claimScan(db,now,'gamerunner')!;return finishScan(db,owner,{products,total:products.length,pages:1,scannedAt:now},now+1);};
    assert.equal(run([product],3000).baseline,true);assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,0);
    run([product,{...product,externalID:'B'}],700000);assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,2);
    const payload=JSON.parse(String(db.prepare('SELECT payload FROM mobile_push_outbox').get()!.payload));assert.equal(payload.kind,'product');assert.equal(payload.shopId,'gamerunner');assert.equal(payload.productUrl,product.url);assert.equal(payload.path,'/pokemon#shop-gamerunner');
    assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_mail_outbox').get()!.n,0);
    run([product,{...product,externalID:'B'}],800000);assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,2);
    saveNotifications(db,email,'gamerunner',true,{notify_new:0,notify_restock:1,notify_preorder:1});run([product,{...product,externalID:'B'},{...product,externalID:'C'}],900000);assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,2);
    const beforeCancel=Number(db.prepare("SELECT count(*) AS n FROM mobile_push_outbox WHERE state='cancelled'").get()!.n);
    cancelShopPush(db,'cardverse');assert.equal(Number(db.prepare("SELECT count(*) AS n FROM mobile_push_outbox WHERE state='cancelled'").get()!.n),beforeCancel);
    cancelShopPush(db,'gamerunner');assert.equal(Number(db.prepare("SELECT count(*) AS n FROM mobile_push_outbox WHERE state='cancelled'").get()!.n),2);
  }finally{db.close();}
});
test('Push: test rate-limited per device; configured send claims once and records FCM acceptance',async()=>{
  const db=database();try{
    const a=paired(db);updateDevice(db,a.device,fcm,true,2000);const device=deviceBySecret(db,a.secret,3000);
    queueTestPush(db,device,400000);assert.throws(()=>queueTestPush(db,device,400001));
    let sends=0;
    await sendNextPush(db,{configured:true,now:400002,deliver:async(token,data)=>{sends++;assert.equal(token,fcm);assert.equal(data.path,'/pokemon');return {state:'sent'};}});
    await sendNextPush(db,{configured:true,now:400003,deliver:async()=>{sends++;return {state:'sent'};}});
    assert.equal(sends,1);assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()!.state,'sent');
  }finally{db.close();}
});
test('Push: uncertain submission is never automatically resent, stale sending lease recovered as uncertain',async()=>{
  const db=database();try{
    const a=paired(db);updateDevice(db,a.device,fcm,true,2000);queueTestPush(db,deviceBySecret(db,a.secret,3000),400000);
    await sendNextPush(db,{configured:true,now:400001,deliver:async()=>({state:'uncertain',error:'timeout'})});
    assert.equal(claimPush(db,400002),null);assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()!.state,'uncertain');
    queueTestPush(db,deviceBySecret(db,a.secret,700000),700000);claimPush(db,700001);assert.equal(claimPush(db,830000),null);
    assert.equal(db.prepare("SELECT count(*) AS n FROM mobile_push_outbox WHERE state='uncertain'").get()!.n,2);
  }finally{db.close();}
});
test('Push: disabled config sends nothing, expired notifications do not send, revoke cancels queued jobs',async()=>{
  const db=database();try{
    const a=paired(db);updateDevice(db,a.device,fcm,true,2000);queueTestPush(db,deviceBySecret(db,a.secret,3000),400000);
    await sendNextPush(db,{configured:false,now:400001,deliver:async()=>{throw new Error('should not send');}});
    assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()!.state,'queued');assert.equal(claimPush(db,1300001),null);
    assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()!.state,'expired');
    queueTestPush(db,deviceBySecret(db,a.secret,1400000),1400000);revokeDevice(db,a.deviceId);
    assert.equal(db.prepare("SELECT count(*) AS n FROM mobile_push_outbox WHERE state='cancelled'").get()!.n,1);
  }finally{db.close();}
});
test('Push: invalid token deactivates only the rejected device, and pre-submit failure retries',async()=>{
  const db=database();try{
    const a=paired(db),b=paired(db,2000);updateDevice(db,a.device,fcm,true,3000);updateDevice(db,b.device,fcm+'other',true,3000);
    queueTestPush(db,deviceBySecret(db,a.secret,3001),400000);
    await sendNextPush(db,{configured:true,now:400001,deliver:async()=>({state:'retry',error:'oauth unavailable'})});
    assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()!.state,'retry');
    await sendNextPush(db,{configured:true,now:461000,deliver:async()=>({state:'failed',invalidToken:true,error:'UNREGISTERED'})});
    assert.equal(deviceBySecret(db,a.secret,462000).push_enabled,0);assert.equal(deviceBySecret(db,b.secret,462000).push_enabled,1);
  }finally{db.close();}
});
