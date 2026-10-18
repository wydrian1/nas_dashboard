import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deliverFcm } from '../lib/mobile/push.ts';

test('FCM: fixed Google endpoints/project, server-only RSA credential, data-only push and bounded TTL',async()=>{
  const tempBase=process.platform==='win32' ? join(tmpdir(),'opencode') : tmpdir();
  const folder=mkdtempSync(join(tempBase,'wydrian-fcm-test-')),file=join(folder,'test-key.json');
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  writeFileSync(file,JSON.stringify({type:'service_account',project_id:'nas-wydrian-hu',client_email:'test@nas-wydrian-hu.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://oauth2.googleapis.com/token'}),{mode:0o600});
  const originalFetch=globalThis.fetch,oldPath=process.env.POKEMON_FCM_CREDENTIALS;process.env.POKEMON_FCM_CREDENTIALS=file;
   let requestCount=0,mode='sent',target:'android'|'browser'='android';
  globalThis.fetch=async(input,init)=>{
    const url=String(input);requestCount++;
    if(url==='https://oauth2.googleapis.com/token'){
      assert.equal(init?.redirect,'error');const assertion=(init!.body as URLSearchParams).get('assertion')!;
      assert.equal(JSON.parse(Buffer.from(assertion.split('.')[1],'base64url').toString()).scope,'https://www.googleapis.com/auth/firebase.messaging');
      return Response.json({access_token:'test-access-token',expires_in:3600});
    }
    assert.equal(url,'https://fcm.googleapis.com/v1/projects/nas-wydrian-hu/messages:send');assert.equal(init?.redirect,'error');
     const body=JSON.parse(String(init!.body));assert.equal(body.message.token,'test-device-token');assert.equal(body.message.notification,undefined);
     if(target==='android'){assert.equal(body.message.android.priority,'HIGH');assert.equal(body.message.android.ttl,'900s');assert.equal(body.message.webpush,undefined);assert.equal(body.message.android.collapse_key,undefined);}else{assert.deepEqual(body.message.webpush.headers,{TTL:'900',Urgency:'high'});assert.equal(body.message.android,undefined);}
     assert.equal(body.message.data.path,'/pokemon'); // >4 separate events must not be dropped by collapse-key limits.
    if(mode==='network')throw new Error('transport stopped');
    if(mode==='invalid')return Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404});
    if(mode==='retry')return Response.json({error:{}},{status:429,headers:{'Retry-After':'120'}});
    return Response.json({name:'projects/nas-wydrian-hu/messages/test'});
  };
  try{
    const payload={title:'Test',body:'Test body',path:'/pokemon',eventId:'1'};
    assert.equal((await deliverFcm('test-device-token',payload,2000)).state,'sent');assert.equal(requestCount,2);
    mode='retry';const retry=await deliverFcm('test-device-token',payload,2000);assert.equal(retry.state,'retry');assert.equal(retry.retryAfterMs,120000);
    mode='invalid';assert.equal((await deliverFcm('test-device-token',payload,2000)).invalidToken,true);
    mode='network';assert.equal((await deliverFcm('test-device-token',payload,2000)).state,'uncertain');
    mode='sent';target='browser';assert.equal((await deliverFcm('test-device-token',payload,900,()=>true,'browser')).state,'sent');
    assert.equal(requestCount,6); // Cached short-lived OAuth token never exposed to the app.
    process.env.POKEMON_FCM_CREDENTIALS=file+'missing';const before=requestCount;
    assert.equal((await deliverFcm('test-device-token',payload)).state,'retry');assert.equal(requestCount,before);
  }finally{globalThis.fetch=originalFetch;if(oldPath===undefined)delete process.env.POKEMON_FCM_CREDENTIALS;else process.env.POKEMON_FCM_CREDENTIALS=oldPath;unlinkSync(file);rmdirSync(folder);}
});
