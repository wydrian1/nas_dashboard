"use server";
import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/auth';
import {db} from '@/lib/db';
import {saveImportantInfo,ImportantInfoError} from '@/lib/important-info/store';
import type {ActionResult} from '@/lib/personal-types';
export async function saveInfo(_previous:ActionResult,data:FormData):Promise<ActionResult&{savedRevision?:number}>{
  try{const session=await requireAdmin();const savedRevision=saveImportantInfo(db(),session.user!.email!,data.get('html'),data.get('revision'));revalidatePath('/important-info');return {success:'A fontos infók elmentve.',savedRevision};}
  catch(error){return {error:error instanceof ImportantInfoError ? error.message : 'A szöveg mentéséhez admin jogosultság szükséges, vagy a mentés nem sikerült.'};}
}
