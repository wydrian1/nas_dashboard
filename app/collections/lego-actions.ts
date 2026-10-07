"use server";
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { saveLego, removeLego } from '@/lib/finance/lego';
import { FinanceInputError } from '@/lib/finance/types';
import type { ActionResult } from '@/lib/personal-types';

export async function saveLegoItem(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  let email:string;try{const session=await requireAdmin();email=session.user!.email!;}catch{return {error:'A LEGO-listához admin jogosultság szükséges.'};}
  try{saveLego(db(),data,email);revalidatePath('/collections');revalidatePath('/finance');return {success:'LEGO-tétel elmentve. A havi vagyonadatok változatlanok.'};}
  catch(error){return {error:error instanceof FinanceInputError ? error.message : 'A LEGO-tétel mentése nem sikerült.'};}
}
export async function deleteLegoItem(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  let email:string;try{const session=await requireAdmin();email=session.user!.email!;}catch{return {error:'A LEGO-listához admin jogosultság szükséges.'};}
  try{removeLego(db(),data,email);revalidatePath('/collections');revalidatePath('/finance');return {success:'LEGO-tétel törölve a listából. Az előzmény megmaradt.'};}
  catch(error){return {error:error instanceof FinanceInputError ? error.message : 'A LEGO-tétel törlése nem sikerült.'};}
}
