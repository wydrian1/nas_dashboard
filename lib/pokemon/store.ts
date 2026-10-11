import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PokemonShop, ShopID, ShopScan, StoredProduct } from "./types.ts";
import { queuePushEvent } from "../mobile/store.ts";
import type {ShopFailureKind} from './health.ts';

export function transaction<T>(database:DatabaseSync, operation:()=>T):T {
  database.exec("BEGIN IMMEDIATE");
  try {const result=operation();database.exec("COMMIT");return result;}
  catch(error){database.exec("ROLLBACK");throw error;}
}
export function shop(database:DatabaseSync,shopID:ShopID='gamerunner'):PokemonShop {
  const row=database.prepare("SELECT * FROM pokemon_shops WHERE id=?").get(shopID);
  if(!row)throw new Error("Ismeretlen webshop.");
  return {...row} as PokemonShop;
}
export function claimScan(database:DatabaseSync, now=Date.now(),shopID:ShopID='gamerunner'):string|null {
  const owner=randomUUID();
  const result=database.prepare(`UPDATE pokemon_shops SET lease_owner=?,lease_until=?,status='scanning',manual_requested=0
    WHERE id=? AND enabled=1 AND lease_until<=? AND next_scan<=?`).run(owner,now+5*60_000,shopID,now,now);
  return result.changes ? owner : null;
}
function owned(database:DatabaseSync,owner:string,now:number):PokemonShop {
  const row=database.prepare("SELECT * FROM pokemon_shops WHERE lease_owner=? AND lease_until>?").get(owner,now);
  if(!row)throw new Error("A webshopvizsgálat zárolása lejárt.");
  return {...row} as PokemonShop;
}
export function failScan(database:DatabaseSync,owner:string,message:string,retryAfterMs=0,now=Date.now(),kind:ShopFailureKind='error') {
  transaction(database,()=>{
    const current=owned(database,owner,now);
    const backoff=Math.max(current.interval_minutes*60_000,Math.min(6*60*60_000,60_000*2**Math.min(current.failure_count+1,9)),retryAfterMs,['maintenance','protected'].includes(kind)?15*60_000:0);
    database.prepare("INSERT INTO pokemon_scans VALUES(?,?,?,?,?,?,?,?)").run(owner,current.id,current.lease_until-5*60_000,now,"failed",null,null,message.slice(0,500));
    database.prepare("UPDATE pokemon_shops SET status=?,last_error=?,failure_count=failure_count+1,next_scan=?,lease_until=0,lease_owner=NULL WHERE id=?").run(kind,message.slice(0,500),now+backoff,current.id);
  });
}
export function finishScan(database:DatabaseSync,owner:string,scan:ShopScan,now=Date.now()) {
  if(scan.products.length!==scan.total || scan.total>600 || new Set(scan.products.map(product=>product.externalID)).size!==scan.total)throw new Error("Hiányos vizsgálat nem menthető.");
  return transaction(database,()=>{
    const current=owned(database,owner,now);
    if(!current.enabled){database.prepare("UPDATE pokemon_shops SET status='paused',lease_until=0,lease_owner=NULL WHERE id=?").run(current.id);return {baseline:false,events:0,deferred:true};}
    const old=database.prepare("SELECT * FROM pokemon_products WHERE shop_id=?").all(current.id) as StoredProduct[];
    const previous=new Map(old.map(product=>[product.external_id,product]));
    const signature=JSON.stringify(scan.products.map(product=>product.externalID).sort());
    const suspicious=current.baseline_at!==null && scan.total<current.last_count/2;
    if(suspicious && current.pending_drop!==signature){
      database.prepare("INSERT INTO pokemon_scans VALUES(?,?,?,?,?,?,?,?)").run(owner,current.id,current.lease_until-5*60_000,now,"deferred",scan.total,scan.pages,"A nagy készletcsökkenést a következő teljes vizsgálatnak meg kell erősítenie.");
      database.prepare("UPDATE pokemon_shops SET pending_drop=?,status='warning',last_error=?,next_scan=?,lease_until=0,lease_owner=NULL WHERE id=?").run(signature,"Szokatlan készletcsökkenés; az előző állapot megmaradt.",now+current.interval_minutes*60_000,current.id);
      return {baseline:false,events:0,deferred:true};
    }
    const baseline=current.baseline_at===null;
    const present=new Set(scan.products.map(product=>product.externalID));
    let events=0;
    for(const product of scan.products){
      const before=previous.get(product.externalID);
      const returned=!!before && !before.in_stock;
      const episode=before ? before.episode+Number(returned) : 1;
      database.prepare(`INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,image,price_huf,availability,in_stock,episode,first_seen,last_seen)
        VALUES(?,?,?,?,?,?,?,?,1,?,?,?) ON CONFLICT(shop_id,external_id) DO UPDATE SET sku=excluded.sku,title=excluded.title,url=excluded.url,image=excluded.image,
        price_huf=excluded.price_huf,availability=excluded.availability,in_stock=1,missing_count=0,episode=excluded.episode,last_seen=excluded.last_seen`).run(current.id,product.externalID,product.sku,product.title,product.url,product.image,product.priceHuf,product.availability,episode,before?.first_seen ?? now,now);
      if(baseline || (before && !returned))continue;
      const kind=before ? 'restock' : product.availability==='preorder' ? 'preorder' : 'new';
      // Keep the old mail_state column only for database compatibility/history.
      const inserted=database.prepare("INSERT OR IGNORE INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,price_huf,occurred_at,mail_state) VALUES(?,?,?,?,?,?,?,?,?,'not_requested')").run(owner,current.id,product.externalID,episode,kind,product.title,product.url,product.priceHuf,now);
      if(inserted.changes){
        events++;
        queuePushEvent(database,Number(inserted.lastInsertRowid),current.id,product.title,kind,product.priceHuf,now);
      }
    }
    for(const before of old){if(!present.has(before.external_id))database.prepare("UPDATE pokemon_products SET missing_count=missing_count+1,in_stock=CASE WHEN missing_count+1>=2 THEN 0 ELSE in_stock END WHERE shop_id=? AND external_id=?").run(current.id,before.external_id);}
    database.prepare("INSERT INTO pokemon_scans VALUES(?,?,?,?,?,?,?,?)").run(owner,current.id,current.lease_until-5*60_000,now,baseline?'baseline':'success',scan.total,scan.pages,null);
    database.prepare(`UPDATE pokemon_shops SET baseline_at=COALESCE(baseline_at,?),last_success=?,next_scan=?,last_count=?,pending_drop=NULL,
      status='ok',last_error=NULL,failure_count=0,lease_until=0,lease_owner=NULL WHERE id=?`).run(now,now,now+current.interval_minutes*60_000,scan.total,current.id);
    // Keep operational logs bounded; product identity and notification deduplication are retained.
    database.prepare("DELETE FROM pokemon_scans WHERE finished_at<?").run(now-90*24*60*60_000);
    return {baseline,events,deferred:false};
  });
}
