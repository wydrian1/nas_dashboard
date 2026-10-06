"use server";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/auth";
import type { Session } from 'next-auth';
import { db } from "@/lib/db";
import { InputError, type ActionResult } from "@/lib/personal-types";
import { transaction, shop } from "@/lib/pokemon/store";
import { isShopID, validScanInterval, type ShopID } from "@/lib/pokemon/types";
import { cancelShopPush } from "@/lib/mobile/store";
import { saveNotifications } from '@/lib/pokemon/notifications';

function selectedShop(data:FormData):ShopID {
  const value=data.get('shopID');
  if(!isShopID(value))throw new InputError("Ismeretlen webshop.");
  return value;
}

async function mutate(operation:(session:Session)=>void,success:string,admin=true):Promise<ActionResult> {
  let session:Session;
  try{session=await (admin ? requireAdmin() : requireUser());}catch{return {error:admin ? 'Admin jogosultság szükséges.' : 'Jelentkezz be újra a módosításhoz.'};}
  try{transaction(db(),()=>operation(session));revalidatePath('/pokemon');return {success};}
  catch(error){return {error:error instanceof InputError ? error.message : "A módosítás nem sikerült. Próbáld újra."};}
}
export async function savePokemonSettings(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  return mutate(()=>{
    const shopID=selectedShop(data);
    const interval=Number(data.get('interval'));
    if(!validScanInterval(interval))throw new InputError("Az ellenőrzés gyakorisága 3–60 perc lehet.");
    const current=shop(db(),shopID),enabled=data.get('enabled')==='on';
    // Never bypass a server-imposed Retry-After or an active scan.
    const next=current.failure_count || current.lease_owner ? current.next_scan : Date.now()+interval*60_000;
    cancelShopPush(db(),shopID);
    db().prepare(`UPDATE pokemon_shops SET enabled=?,interval_minutes=?,emails_enabled=0,
      next_scan=?,status=CASE WHEN ?=0 THEN 'paused' WHEN status='paused' THEN 'idle' ELSE status END WHERE id=?`).run(Number(enabled),interval,next,Number(enabled),shopID);
  },"Beállítások elmentve. A még várakozó webshop-pushok törölve; régi eseményeket nem küldünk visszamenőleg.");
}
export async function savePokemonNotifications(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  return mutate(session=>{
    const shopID=selectedShop(data);
    saveNotifications(db(),session.user!.email!,shopID,data.get('notifications')==='on',
      session.role==='admin' ? {notify_new:Number(data.get('new')==='on'),notify_restock:Number(data.get('restock')==='on'),notify_preorder:Number(data.get('preorder')==='on')} : undefined);
  },'A saját értesítési beállításaid elmentve. Más felhasználó értesítései nem változtak.',false);
}
export async function requestPokemonScan(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  return mutate(()=>{
    const shopID=selectedShop(data),current=shop(db(),shopID),now=Date.now();
    if(!current.enabled)throw new InputError("A figyelés szünetel. Előbb kapcsold be.");
    if(current.lease_until>now || current.manual_requested)throw new InputError("Már folyamatban van vagy várakozik egy vizsgálat.");
    if(current.failure_count && current.next_scan>now)throw new InputError("Hiba utáni várakozás aktív; nem terheljük újra a webshopot.");
    db().prepare("UPDATE pokemon_shops SET manual_requested=1,next_scan=? WHERE id=?").run(Math.max(now,(current.last_success || 0)+60_000),shopID);
  },"Vizsgálat ütemezve. Az eredmény automatikusan megjelenik.");
}
