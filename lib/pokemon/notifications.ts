import type { DatabaseSync } from 'node:sqlite';
import { roleFor, requireAccess, canAccess, type Role } from '../users.ts';
import { isShopID } from './types.ts';
import {deliveryPreferences,watchRules,watchMatches} from '../mobile/preferences.ts';

export type NotificationSettings={enabled:number;notify_new:number;notify_restock:number;notify_preorder:number};
export function notificationSettings(db:DatabaseSync,email:string,shopID:string):NotificationSettings {
  const row=db.prepare('SELECT enabled,notify_new,notify_restock,notify_preorder FROM pokemon_user_notifications WHERE email=? AND shop_id=?').get(email.toLowerCase(),shopID);
  return row ? {...row} as NotificationSettings : {enabled:1,notify_new:1,notify_restock:1,notify_preorder:1};
}
export function notificationAllowed(db:DatabaseSync,email:string,eventID:number):boolean {
   const role=roleFor(db,email);if(!canAccess(role,'pokemon'))return false;
   const event=db.prepare(`SELECT e.shop_id,e.kind,e.title,e.price_huf,p.availability,s.enabled FROM pokemon_events e
     JOIN pokemon_shops s ON s.id=e.shop_id LEFT JOIN pokemon_products p ON p.shop_id=e.shop_id AND p.external_id=e.external_id WHERE e.id=?`).get(eventID) as {shop_id:string;kind:string;title:string;price_huf:number|null;availability:string;enabled:number}|undefined;
   if(!event?.enabled)return false;
   if(deliveryPreferences(db,email).watchlist_only&&!watchRules(db,email).some(rule=>watchMatches(rule,event)))return false;
  const settings=notificationSettings(db,email,event.shop_id);
  if(role==='pokemon-reader')return !!settings.enabled;
  return !!settings.enabled && !!(event.kind==='restock' ? settings.notify_restock : settings.notify_new)
    && (event.kind!=='preorder' && event.availability!=='preorder' || !!settings.notify_preorder);
}
export function saveNotifications(db:DatabaseSync,email:string,shopID:unknown,enabled:boolean,types?:Omit<NotificationSettings,'enabled'>) {
  const role:Role=requireAccess(db,email,'pokemon');
  if(!isShopID(shopID))throw new Error('Ismeretlen webshop.');
  const current=notificationSettings(db,email,shopID),values=role==='admin' && types ? types : current;
  db.prepare(`INSERT INTO pokemon_user_notifications(email,shop_id,enabled,notify_new,notify_restock,notify_preorder) VALUES(?,?,?,?,?,?)
    ON CONFLICT(email,shop_id) DO UPDATE SET enabled=excluded.enabled,notify_new=excluded.notify_new,notify_restock=excluded.notify_restock,notify_preorder=excluded.notify_preorder`)
    .run(email.toLowerCase(),shopID,Number(enabled),Number(!!values.notify_new),Number(!!values.notify_restock),Number(!!values.notify_preorder));
  db.prepare(`UPDATE mobile_push_outbox SET state='cancelled' WHERE state IN ('queued','retry')
    AND device_id IN (SELECT id FROM mobile_devices WHERE email=?) AND event_id IN (SELECT id FROM pokemon_events WHERE shop_id=?)`).run(email.toLowerCase(),shopID);
}
