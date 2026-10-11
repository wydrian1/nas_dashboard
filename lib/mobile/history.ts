import type {DatabaseSync} from 'node:sqlite';
import {requireAccess} from '../users.ts';
export type PushHistory={id:string;state:string;created_at:number;sent_at:number|null;title:string;shop_id:string|null};
export function pushHistory(db:DatabaseSync,email:string):PushHistory[]{
  requireAccess(db,email,'pokemon');
  // No FCM tokens, pairing secrets, payloads or another account's notifications.
  return db.prepare(`SELECT o.id,o.state,o.created_at,o.sent_at,COALESCE(e.title,'Rendszerértesítés') title,e.shop_id
    FROM mobile_push_outbox o JOIN mobile_devices d ON d.id=o.device_id LEFT JOIN pokemon_events e ON e.id=o.event_id
    WHERE d.email=? ORDER BY o.created_at DESC,o.id DESC LIMIT 100`).all(email.toLowerCase()).map(row=>({...row} as PushHistory));
}
