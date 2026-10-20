import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { SHOP_NAMES, isShopID } from '../pokemon/types.ts';
import { roleFor, canAccess } from '../users.ts';
import { notificationAllowed } from '../pokemon/notifications.ts';
import {deliveryPreferences,quietNow,productPushDue} from './preferences.ts';

export const MOBILE_ORIGIN='https://nas.wydrian.hu';
export const MOBILE_PROJECT='nas-wydrian-hu';
export const opaque=()=>randomBytes(32).toString('base64url');
export const digest=(input:string)=>createHash('sha256').update(input).digest('base64url');
const validOpaque=(input:unknown):input is string=>typeof input==='string' && /^[A-Za-z0-9_-]{43}$/.test(input);
export type MobileDevice={id:string;label:string;email:string;expires_at:number;revoked:number;push_enabled:number;fcm_token:string|null;last_seen:number;created_at:number;last_test:number;device_type:'android'|'browser'};
export class MobileError extends Error {
  status:number;
  constructor(message:string,status=400){super(message);this.status=status;}
}
function atomic<T>(db:DatabaseSync,operation:()=>T):T {
  db.exec('BEGIN IMMEDIATE');try{const value=operation();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}
}
export function startPair(db:DatabaseSync,challenge:unknown,label:unknown,now=Date.now()) {
  if(!validOpaque(challenge) || typeof label!=='string' || !label.trim() || label.length>80 || /[\x00-\x1f]/.test(label))throw new MobileError('Érvénytelen eszközadat.');
  return atomic(db,()=>{
    db.prepare('DELETE FROM mobile_pairs WHERE expires_at<?').run(now-60_000);
    const recent=db.prepare('SELECT count(*) AS n FROM mobile_pairs WHERE created_at>?').get(now-60_000) as {n:number};
    const pending=db.prepare('SELECT count(*) AS n FROM mobile_pairs WHERE expires_at>? AND consumed=0').get(now) as {n:number};
    if(recent.n>=10 || pending.n>=30)throw new MobileError('Túl sok párosítás; próbáld később.',429);
    const id=opaque(),code=randomBytes(4).toString('hex').toUpperCase(),expiresAt=now+5*60_000;
    db.prepare('INSERT INTO mobile_pairs(id,challenge,label,code,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(id,challenge,label.trim(),code,now,expiresAt);
    return {id,code,expiresAt,url:MOBILE_ORIGIN+'/mobile/connect?id='+id};
  });
}
export function pairInfo(db:DatabaseSync,id:unknown,now=Date.now()) {
  if(!validOpaque(id))throw new MobileError('Érvénytelen párosítás.');
  const row=db.prepare('SELECT id,label,code,approved_email,expires_at,consumed FROM mobile_pairs WHERE id=? AND expires_at>? AND consumed=0').get(id,now);
  if(!row)throw new MobileError('Lejárt vagy már felhasznált párosítás.',410);
  return {...row} as {id:string;label:string;code:string;approved_email:string|null;expires_at:number;consumed:number};
}
export function approvePair(db:DatabaseSync,id:unknown,email:string,now=Date.now()) {
  if(!canAccess(roleFor(db,email),'mobile-self'))throw new MobileError('Nincs jogosultság.',403);
  atomic(db,()=>{
    const pair=pairInfo(db,id,now);
    if(pair.approved_email && pair.approved_email!==email.toLowerCase())throw new MobileError('Ezt a párosítást már másik fiók jóváhagyta.',403);
    db.prepare('UPDATE mobile_pairs SET approved_email=? WHERE id=? AND consumed=0 AND expires_at>?').run(email.toLowerCase(),pair.id,now);
  });
}
export function exchangePair(db:DatabaseSync,id:unknown,verifier:unknown,now=Date.now()) {
  if(!validOpaque(id) || !validOpaque(verifier))throw new MobileError('Érvénytelen párosítás.');
  return atomic(db,()=>{
    const pair=db.prepare('SELECT * FROM mobile_pairs WHERE id=? AND challenge=? AND consumed=0 AND expires_at>?').get(id,digest(verifier),now) as {label:string;approved_email:string|null}|undefined;
    if(!pair)throw new MobileError('Lejárt vagy érvénytelen párosítás.',410);
    if(!pair.approved_email)return null;
    if(!canAccess(roleFor(db,pair.approved_email),'mobile-self'))throw new MobileError('Nincs jogosultság.',403);
     const count=db.prepare("SELECT count(*) AS n FROM mobile_devices WHERE email=? AND device_type='android' AND revoked=0 AND expires_at>?").get(pair.approved_email,now) as {n:number};
    if(count.n>=10)throw new MobileError('Legfeljebb 10 telefon kapcsolható; előbb vonj vissza egyet.',409);
    const deviceId=opaque(),secret=opaque(),expiresAt=now+90*24*60*60_000;
    db.prepare('INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen) VALUES(?,?,?,?,?,?,?)').run(deviceId,pair.label,pair.approved_email,digest(secret),now,expiresAt,now);
    db.prepare('UPDATE mobile_pairs SET consumed=1 WHERE id=?').run(id);
    return {deviceId,secret,expiresAt};
  });
}
export function deviceBySecret(db:DatabaseSync,secret:unknown,now=Date.now()):MobileDevice {
  if(!validOpaque(secret))throw new MobileError('Bejelentkezés szükséges.',401);
   const device=db.prepare("SELECT * FROM mobile_devices WHERE secret_hash=? AND device_type='android' AND revoked=0 AND expires_at>?").get(digest(secret),now) as MobileDevice|undefined;
  if(!device || !canAccess(roleFor(db,device.email),'mobile-self'))throw new MobileError('Új párosítás szükséges.',401);
  return device;
}
export function deviceAuthorized(db:DatabaseSync,id:string,email:string,now=Date.now()):boolean {
  return !!canAccess(roleFor(db,email),'mobile-self') && !!db.prepare('SELECT 1 FROM mobile_devices WHERE id=? AND email=? AND revoked=0 AND expires_at>?').get(id,email.toLowerCase(),now);
}
export function updateDevice(db:DatabaseSync,device:MobileDevice,token:unknown,enabled:unknown,now=Date.now()) {
  if(device.device_type!=='android')throw new MobileError('Ez a művelet csak Android-eszközre érvényes.',403);
  if(typeof enabled!=='boolean' || (token!==null && (typeof token!=='string' || token.length<20 || token.length>4096 || !/^[a-zA-Z0-9_:.-]+$/.test(token))))throw new MobileError('Érvénytelen push-adat.');
  if(enabled && !token)throw new MobileError('Hiányzó Firebase-azonosító.');
  const role=roleFor(db,device.email),pushDenied=role==='info-reader' || !canAccess(role,'mobile-self'),effectiveToken=pushDenied ? null : token,effectiveEnabled=pushDenied ? false : enabled;
  atomic(db,()=>{
    // Reinstall/re-pair can produce the same token: never notify it twice.
    if(effectiveToken)db.prepare('UPDATE mobile_devices SET push_enabled=0,fcm_token=NULL WHERE fcm_token=? AND id<>?').run(effectiveToken,device.id);
    db.prepare('UPDATE mobile_devices SET fcm_token=?,push_enabled=?,last_seen=?,token_updated_at=? WHERE id=? AND revoked=0').run(effectiveToken,Number(effectiveEnabled),now,now,device.id);
    if(!effectiveEnabled)db.prepare("UPDATE mobile_push_outbox SET state='cancelled' WHERE device_id=? AND state IN ('queued','retry')").run(device.id);
  });
}
export function registerBrowserPush(db:DatabaseSync,email:string,token:unknown,label:unknown='Böngésző',now=Date.now()){
  const owner=email.trim().toLowerCase();
  if(!canAccess(roleFor(db,owner),'mobile-self'))throw new MobileError('Ehhez a szerepkörhöz nincs push-értesítés.',403);
  if(typeof token!=='string'||token.length<20||token.length>4096||!/^[A-Za-z0-9_:-]+$/.test(token)||typeof label!=='string'||!label.trim()||label.length>80||/[\x00-\x1f]/.test(label))throw new MobileError('Érvénytelen böngésző-push adat.');
  return atomic(db,()=>{
    const existing=db.prepare('SELECT id,email,device_type FROM mobile_devices WHERE fcm_token=? AND revoked=0').get(token) as {id:string;email:string;device_type:string}|undefined;
    if(existing){
      if(existing.email!==owner||existing.device_type!=='browser')throw new MobileError('Ez a böngésző-értesítési azonosító már másik eszközhöz tartozik.',409);
      db.prepare("UPDATE mobile_devices SET label=?,push_enabled=1,last_seen=?,expires_at=?,token_updated_at=? WHERE id=?").run(label.trim(),now,now+90*24*60*60_000,now,existing.id);
      return {id:existing.id,expiresAt:now+90*24*60*60_000};
    }
    const count=db.prepare("SELECT count(*) AS n FROM mobile_devices WHERE email=? AND device_type='browser' AND revoked=0 AND expires_at>?").get(owner,now) as {n:number};
    if(count.n>=10)throw new MobileError('Legfeljebb 10 böngésző kapcsolható; előbb vonj vissza egyet.',409);
    const id=opaque(),secret=opaque(),expiresAt=now+90*24*60*60_000;
    db.prepare("INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token,token_updated_at,device_type) VALUES(?,?,?,?,?,?,?,1,?,?, 'browser')").run(id,label.trim(),owner,digest(secret),now,expiresAt,now,token,now);
    return {id,expiresAt};
  });
}
export function removeBrowserPush(db:DatabaseSync,email:string,token:unknown,now=Date.now()){
  if(typeof token!=='string'||token.length<20||token.length>4096||!/^[A-Za-z0-9_:-]+$/.test(token))throw new MobileError('Érvénytelen böngésző-push azonosító.');
  const owner=email.trim().toLowerCase();
  return atomic(db,()=>{
    const row=db.prepare("SELECT id FROM mobile_devices WHERE email=? AND fcm_token=? AND device_type='browser' AND revoked=0").get(owner,token) as {id:string}|undefined;
    if(row){db.prepare("UPDATE mobile_devices SET push_enabled=0,fcm_token=NULL,last_seen=? WHERE id=?").run(now,row.id);db.prepare("UPDATE mobile_push_outbox SET state='cancelled',lease_until=0 WHERE device_id=? AND state IN ('queued','retry')").run(row.id);}
    return !!row;
  });
}
export function revokeDevice(db:DatabaseSync,id:string) {
  atomic(db,()=>{
    db.prepare('UPDATE mobile_devices SET revoked=1,push_enabled=0,fcm_token=NULL WHERE id=?').run(id);
    db.prepare("UPDATE mobile_push_outbox SET state='cancelled' WHERE device_id=? AND state IN ('queued','retry')").run(id);
  });
}
export function queuePushEvent(db:DatabaseSync,eventId:number,shopId:string,title:string,kind:string,price:number|null,now:number) {
  const event=db.prepare('SELECT url FROM pokemon_events WHERE id=? AND shop_id=?').get(eventId,shopId) as {url:string}|undefined;
  const payload=JSON.stringify({title:(isShopID(shopId) ? SHOP_NAMES[shopId] : 'Pokémon')+' · '+(kind==='restock' ? 'Újra elérhető' : kind==='preorder' ? 'Új előrendelés' : 'Új termék'),body:title.slice(0,180)+(price!==null ? ' · '+price.toLocaleString('hu-HU')+' Ft' : ''),kind:'product',shopId,productUrl:event?.url??'',path:'/pokemon#shop-'+shopId,eventId:String(eventId)});
  const devices=db.prepare('SELECT id,email FROM mobile_devices WHERE revoked=0 AND push_enabled=1 AND fcm_token IS NOT NULL AND expires_at>?').all(now) as {id:string;email:string}[];
  for(const device of devices){
    if(!notificationAllowed(db,device.email,eventId))continue;
    const recent=db.prepare(`SELECT 1 FROM mobile_push_outbox o JOIN pokemon_events e ON e.id=o.event_id
      JOIN pokemon_events current ON current.id=? WHERE o.device_id=? AND e.shop_id=current.shop_id AND e.external_id=current.external_id AND o.created_at>?`).get(eventId,device.id,now-60*60_000);
    if(!recent){const preferences=deliveryPreferences(db,device.email);db.prepare('INSERT OR IGNORE INTO mobile_push_outbox(id,device_id,event_id,payload,created_at,expires_at,state,next_attempt) VALUES(?,?,?,?,?,?,?,?)').run(opaque(),device.id,eventId,payload,now,now+15*60_000,quietNow(preferences,now)?'muted':'queued',productPushDue(preferences,now));}
  }
}
export function cancelShopPush(db:DatabaseSync,shopId:string) {
  db.prepare(`UPDATE mobile_push_outbox SET state='cancelled' WHERE state IN ('queued','retry') AND event_id IN (SELECT id FROM pokemon_events WHERE shop_id=?)`).run(shopId);
}
export function queueTestPush(db:DatabaseSync,device:MobileDevice,now=Date.now()) {
  if(roleFor(db,device.email)==='info-reader')throw new MobileError('Ehhez a szerepkörhöz nincs push-értesítés.',403);
  if(!device.push_enabled || !device.fcm_token)throw new MobileError('Előbb engedélyezd az értesítéseket.');
  return atomic(db,()=>{
    const changed=db.prepare('UPDATE mobile_devices SET last_test=? WHERE id=? AND last_test<=? AND revoked=0').run(now,device.id,now-5*60_000);
    if(!changed.changes)throw new MobileError('Tesztértesítés legfeljebb ötpercenként kérhető.',429);
    db.prepare('INSERT INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES(?,?,?,?,?)').run(opaque(),device.id,JSON.stringify({title:'Wydrian NAS',body:'A push értesítés működik.',path:'/pokemon',eventId:'test-'+now}),now,now+15*60_000);
  });
}
