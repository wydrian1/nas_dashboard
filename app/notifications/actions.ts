"use server";
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {transaction} from '@/lib/pokemon/store';
import {addWatchRule,deleteWatchRule,saveDeliveryPreferences} from '@/lib/mobile/preferences';
import {InputError,type ActionResult} from '@/lib/personal-types';
import {revalidatePath} from 'next/cache';
async function mutate(data:FormData,operation:(email:string,data:FormData)=>void):Promise<ActionResult>{
  try{const session=await requireUser();if(session.role==='info-reader')return {error:'Ehhez a szerepkörhöz nincs készletértesítés.'};transaction(db(),()=>operation(session.user!.email!,data));revalidatePath('/notifications');return {success:'Saját beállítások mentve. A várakozó termékértesítések törölve; nincs visszamenőleges küldés.'};}
  catch(error){return {error:error instanceof InputError?error.message:'A mentés nem sikerült; ellenőrizd a hozzáférésedet.'};}
}
export async function saveDelivery(_previous:ActionResult,data:FormData){return mutate(data,(email,value)=>saveDeliveryPreferences(db(),email,value));}
export async function addWatch(_previous:ActionResult,data:FormData){return mutate(data,(email,value)=>addWatchRule(db(),email,value));}
export async function removeWatch(_previous:ActionResult,data:FormData){return mutate(data,(email,value)=>deleteWatchRule(db(),email,value.get('id')));}
