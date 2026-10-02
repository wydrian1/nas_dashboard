import { createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { MOBILE_PROJECT } from './store.ts';
import { roleFor } from '../users.ts';
import { notificationAllowed } from '../pokemon/notifications.ts';

type Credential={type:string;project_id:string;client_email:string;private_key:string;token_uri:string};
type PushJob={id:string;device_id:string;event_id:number|null;payload:string;attempts:number;expires_at:number};
type Delivery={state:'sent'|'retry'|'failed'|'uncertain';error?:string;invalidToken?:boolean;retryAfterMs?:number};
export function pushConfigured(env:Record<string,string|undefined>=process.env):boolean {
  return env.POKEMON_PUSH_ENABLED==='true' && !!env.POKEMON_FCM_CREDENTIALS && existsSync(env.POKEMON_FCM_CREDENTIALS);
}
function credential():Credential {
  const path=process.env.POKEMON_FCM_CREDENTIALS;
  if(!path)throw new Error('FCM credential missing.');
  const value=JSON.parse(readFileSync(path,'utf8')) as Credential;
  if(value.type!=='service_account' || value.project_id!==MOBILE_PROJECT || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(value.client_email) || value.token_uri!=='https://oauth2.googleapis.com/token' || !value.private_key?.startsWith('-----BEGIN PRIVATE KEY-----'))throw new Error('Invalid FCM credential.');
  return value;
}
let cached:{token:string;expiresAt:number;path:string}|undefined;
async function accessToken():Promise<string> {
  const path=process.env.POKEMON_FCM_CREDENTIALS!;
  if(cached && cached.path===path && cached.expiresAt>Date.now()+60_000)return cached.token;
  const key=credential(),now=Math.floor(Date.now()/1000),base64=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload=base64({alg:'RS256',typ:'JWT'})+'.'+base64({iss:key.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const assertion=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),createPrivateKey(key.private_key)).toString('base64url');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  if(!response.ok){await response.body?.cancel();throw new Error('FCM authorization rejected.');}
  const data=await response.json() as {access_token?:unknown;expires_in?:unknown};
  if(typeof data.access_token!=='string' || data.access_token.length>8192 || typeof data.expires_in!=='number' || data.expires_in<60)throw new Error('FCM authorization invalid.');
  cached={token:data.access_token,expiresAt:Date.now()+Math.min(3600,data.expires_in)*1000,path};return cached.token;
}
// Returns no token or private-key material. Used once during installation diagnostics.
export async function checkPushAuthorization():Promise<boolean> {await accessToken();return true;}
export async function deliverFcm(token:string,payload:Record<string,string>,ttlSeconds=900):Promise<Delivery> {
  let bearer:string;
  try{bearer=await accessToken();}catch{return {state:'retry',error:'FCM-hitelesítés sikertelen; üzenet még nem került beküldésre.'};}
  try {
    const response=await fetch('https://fcm.googleapis.com/v1/projects/'+MOBILE_PROJECT+'/messages:send',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20_000),headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({message:{token,data:payload,android:{priority:'HIGH',ttl:Math.max(1,Math.min(900,ttlSeconds))+'s'}}})});
    const text=await response.text();
    if(text.length>64_000)return {state:'uncertain',error:'Nem értelmezhető FCM-válasz; nincs automatikus újraküldés.'};
    const data=JSON.parse(text) as {name?:string;error?:{details?:{errorCode?:string}[]}};
    if(response.ok && typeof data.name==='string')return {state:'sent'};
    const invalid=data.error?.details?.some(detail=>detail.errorCode==='UNREGISTERED');
    if(invalid)return {state:'failed',invalidToken:true,error:'A Firebase-eszközazonosító megszűnt.'};
    if(response.status===401)cached=undefined;
    const retry=response.headers.get('retry-after');
    const retryMs=retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Math.max(0,Date.parse(retry)-Date.now())) : 0;
    return {state:[401,429,503].includes(response.status) ? 'retry' : 'failed',error:'FCM HTTP '+response.status+'; üzenet nem elfogadott.',retryAfterMs:Number.isFinite(retryMs) ? retryMs : 0};
  }catch{return {state:'uncertain',error:'Bizonytalan FCM-beküldés; nincs automatikus újraküldés.'};}
}
export function claimPush(db:DatabaseSync,now=Date.now()):PushJob|null {
  db.prepare("UPDATE mobile_push_outbox SET state='uncertain',error='Küldés alatt megszakadt; nincs automatikus újraküldés.' WHERE state='sending' AND lease_until<=?").run(now);
  db.prepare("UPDATE mobile_push_outbox SET state='expired' WHERE state IN ('queued','retry') AND expires_at<=?").run(now);
  db.prepare("DELETE FROM mobile_push_outbox WHERE created_at<? AND state NOT IN ('queued','retry','sending')").run(now-90*24*60*60_000);
  db.exec('BEGIN IMMEDIATE');
  try{
    const job=db.prepare("SELECT * FROM mobile_push_outbox WHERE state IN ('queued','retry') AND next_attempt<=? AND expires_at>? ORDER BY created_at,id LIMIT 1").get(now,now) as PushJob|undefined;
    if(job)db.prepare("UPDATE mobile_push_outbox SET state='sending',attempts=attempts+1,lease_until=? WHERE id=?").run(now+2*60_000,job.id);
    db.exec('COMMIT');return job || null;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export async function sendNextPush(db:DatabaseSync,options:{configured?:boolean;deliver?:typeof deliverFcm;now?:number}={}) {
  if(!(options.configured ?? pushConfigured()))return;
  const now=options.now ?? Date.now(),job=claimPush(db,now);if(!job)return;
  const device=db.prepare('SELECT fcm_token,email FROM mobile_devices WHERE id=? AND revoked=0 AND push_enabled=1 AND expires_at>?').get(job.device_id,now) as {fcm_token:string;email:string}|undefined;
  if(!device?.fcm_token || !roleFor(db,device.email) || (job.event_id!==null && !notificationAllowed(db,device.email,job.event_id))){db.prepare("UPDATE mobile_push_outbox SET state='cancelled',lease_until=0 WHERE id=?").run(job.id);return;}
  const result=await (options.deliver || deliverFcm)(device.fcm_token,JSON.parse(job.payload),Math.ceil((job.expires_at-now)/1000));
  const state=result.state==='retry' && job.attempts>=4 ? 'failed' : result.state;
  db.prepare('UPDATE mobile_push_outbox SET state=?,error=?,lease_until=0,next_attempt=?,sent_at=? WHERE id=?').run(state,result.error || null,now+Math.max(Math.min(5*60_000,60_000*2**job.attempts),result.retryAfterMs || 0),state==='sent' ? Date.now() : null,job.id);
  if(result.invalidToken)db.prepare('UPDATE mobile_devices SET push_enabled=0,fcm_token=NULL WHERE id=? AND fcm_token=?').run(job.device_id,device.fcm_token);
}
