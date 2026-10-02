"use server";
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { setUserRole, AccessError } from '@/lib/users';
import type { ActionResult } from '@/lib/personal-types';

export async function saveUserRole(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  try{
    const session=await requireAdmin();
    setUserRole(db(),session.user!.email!,data.get('email'),data.get('role'),data.get('active')==='on');
    revalidatePath('/config');revalidatePath('/mobile');
    return {success:'Felhasználói jogosultság elmentve. A változás a következő szerverkérésnél érvényes.'};
  }catch(error){return {error:error instanceof AccessError ? error.message : 'A jogosultság módosítása nem sikerült.'};}
}
