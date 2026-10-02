import type { DatabaseSync } from 'node:sqlite';
import { opaque, digest, startPair, approvePair, exchangePair, deviceBySecret, updateDevice } from '../../lib/mobile/store.ts';

export function registerTestPhone(db:DatabaseSync) {
  const verifier=opaque(),email='wydrian@gmail.com',pair=startPair(db,digest(verifier),'Test phone',0);
  approvePair(db,pair.id,email,1);const result=exchangePair(db,pair.id,verifier,2)!;
  updateDevice(db,deviceBySecret(db,result.secret,3),'test-fcm-token-abcdefghijklmnopqrstuvwxyz',true,3);
  return result;
}
export function pushForShop(db:DatabaseSync,shopId:string) {
  const row=db.prepare('SELECT o.* FROM mobile_push_outbox o JOIN pokemon_events e ON e.id=o.event_id WHERE e.shop_id=? ORDER BY o.created_at DESC LIMIT 1').get(shopId) as {id:string;payload:string;state:string}|undefined;
  if(!row)throw new Error('Missing test push: '+shopId);
  return {...row,data:JSON.parse(row.payload) as {title:string;body:string;path:string;eventId:string}};
}
