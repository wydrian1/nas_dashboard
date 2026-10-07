"use server";
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { savePokemonCollection, removePokemonCollection } from '@/lib/finance/pokemon-collection';
import { FinanceInputError } from '@/lib/finance/types';
import type { ActionResult } from '@/lib/personal-types';

export async function savePokemonItem(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  let email:string;try{const session=await requireAdmin();email=session.user!.email!;}catch{return {error:'A Pokémon-gyűjteményhez admin jogosultság szükséges.'};}
  try{savePokemonCollection(db(),data,email);revalidatePath('/collections');revalidatePath('/finance');return {success:'Pokémon-vásárlás elmentve. A havi vagyonadatok változatlanok.'};}
  catch(error){return {error:error instanceof FinanceInputError ? error.message : 'A Pokémon-vásárlás mentése nem sikerült.'};}
}
export async function deletePokemonItem(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  let email:string;try{const session=await requireAdmin();email=session.user!.email!;}catch{return {error:'A Pokémon-gyűjteményhez admin jogosultság szükséges.'};}
  try{removePokemonCollection(db(),data,email);revalidatePath('/collections');revalidatePath('/finance');return {success:'Pokémon-vásárlás törölve a listából. Az előzmény megmaradt.'};}
  catch(error){return {error:error instanceof FinanceInputError ? error.message : 'A Pokémon-vásárlás törlése nem sikerült.'};}
}
