import type {DatabaseSync} from 'node:sqlite';
import {requireAccess} from '../users.ts';
import {InputError} from './task-inputs.ts';
import {isShopID} from '../pokemon/types.ts';

export type DeliveryPreferences={quiet_enabled:number;quiet_start:number;quiet_end:number;digest_minutes:number;watchlist_only:number};
export type WatchRule={id:number;query:string;shop_id:string|null;language:string;max_huf:number|null};
export const defaultDelivery:DeliveryPreferences={quiet_enabled:0,quiet_start:22*60,quiet_end:8*60,digest_minutes:0,watchlist_only:0};
export function deliveryPreferences(db:DatabaseSync,email:string):DeliveryPreferences {
  const row=db.prepare('SELECT quiet_enabled,quiet_start,quiet_end,digest_minutes,watchlist_only FROM notification_preferences WHERE email=?').get(email.toLowerCase());
  return row?{...row} as DeliveryPreferences:{...defaultDelivery};
}
export function quietNow(preferences:DeliveryPreferences,now:number):boolean {
  if(!preferences.quiet_enabled)return false;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const minutes=Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value);
  return preferences.quiet_start<preferences.quiet_end?minutes>=preferences.quiet_start&&minutes<preferences.quiet_end:minutes>=preferences.quiet_start||minutes<preferences.quiet_end;
}
export function productPushDue(preferences:DeliveryPreferences,now:number):number {
  const window=preferences.digest_minutes*60_000;
  return window?(Math.floor(now/window)+1)*window:now;
}
export function watchRules(db:DatabaseSync,email:string):WatchRule[]{return db.prepare('SELECT id,query,shop_id,language,max_huf FROM pokemon_watch_rules WHERE email=? ORDER BY id').all(email.toLowerCase()).map(row=>({...row} as WatchRule));}
const normalized=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function watchMatches(rule:WatchRule,event:{shop_id:string;title:string;price_huf:number|null}):boolean {
  const title=normalized(event.title);
  if(rule.shop_id&&rule.shop_id!==event.shop_id||rule.query&&!title.includes(normalized(rule.query)))return false;
  if(rule.max_huf!==null&&(event.price_huf===null||event.price_huf>rule.max_huf))return false;
  if(rule.language==='english'&&!/\b(?:english|angol|en|eng)\b/.test(title))return false;
  if(rule.language==='japanese'&&!/\b(?:japanese|japan|jp|jpn)\b/.test(title))return false;
  return true;
}
function cancelPendingProducts(db:DatabaseSync,email:string){db.prepare("UPDATE mobile_push_outbox SET state='cancelled',lease_until=0 WHERE state IN ('queued','retry') AND event_id IS NOT NULL AND device_id IN (SELECT id FROM mobile_devices WHERE email=?)").run(email.toLowerCase());}
const minute=(value:FormDataEntryValue|null)=>{
  if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new InputError('Érvénytelen csendes időszak.');return Number(value.slice(0,2))*60+Number(value.slice(3));
};
export function saveDeliveryPreferences(db:DatabaseSync,email:string,data:FormData){
  requireAccess(db,email,'pokemon');const start=minute(data.get('quiet_start')),end=minute(data.get('quiet_end')),digest=Number(data.get('digest_minutes'));
  if(![0,5,10].includes(digest)||start===end)throw new InputError('Eltérő kezdő/záró idő és 0, 5 vagy 10 perces összefoglaló választható.');
  db.prepare(`INSERT INTO notification_preferences(email,quiet_enabled,quiet_start,quiet_end,digest_minutes,watchlist_only) VALUES(?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET quiet_enabled=excluded.quiet_enabled,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,digest_minutes=excluded.digest_minutes,watchlist_only=excluded.watchlist_only`).run(email.toLowerCase(),Number(data.get('quiet_enabled')==='on'),start,end,digest,Number(data.get('watchlist_only')==='on'));
  cancelPendingProducts(db,email);
}
export function addWatchRule(db:DatabaseSync,email:string,data:FormData){
  requireAccess(db,email,'pokemon');const query=data.get('query'),shop=data.get('shop_id'),language=data.get('language'),price=data.get('max_huf');
  if(typeof query!=='string'||query.length>80||/[\x00-\x1f]/.test(query)||typeof shop!=='string'||shop!==''&&!isShopID(shop)||!['any','english','japanese'].includes(String(language)))throw new InputError('Érvénytelen figyelőlista-szabály.');
  const max=price===''?null:typeof price==='string'&&/^\d{1,8}$/.test(price)?Number(price):NaN;
  if(max!==null&&(!Number.isSafeInteger(max)||max<1||max>10_000_000)||!query.trim()&&!shop&&language==='any'&&max===null)throw new InputError('Adj meg nevet, boltot, nyelvet vagy pozitív Ft-árhatárt.');
  if(Number(db.prepare('SELECT count(*) n FROM pokemon_watch_rules WHERE email=?').get(email.toLowerCase())!.n)>=30)throw new InputError('Legfeljebb 30 személyes szabály kezelhető.');
  db.prepare('INSERT INTO pokemon_watch_rules(email,query,shop_id,language,max_huf) VALUES(?,?,?,?,?)').run(email.toLowerCase(),query.trim(),shop||null,String(language),max);
  cancelPendingProducts(db,email);
}
export function deleteWatchRule(db:DatabaseSync,email:string,id:unknown){
  requireAccess(db,email,'pokemon');if(typeof id!=='string'||!/^\d{1,15}$/.test(id))throw new InputError('Érvénytelen szabályazonosító.');
  db.prepare('DELETE FROM pokemon_watch_rules WHERE id=? AND email=?').run(Number(id),email.toLowerCase());cancelPendingProducts(db,email);
}
