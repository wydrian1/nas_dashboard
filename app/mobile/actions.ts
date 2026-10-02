"use server";
import { signIn, requireUser, requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { pairInfo, approvePair, revokeDevice } from '@/lib/mobile/store';
import { revalidatePath } from 'next/cache';

export async function mobileLogin(data:FormData) {
  const pair=pairInfo(db(),data.get('id'));
  await signIn('google',{redirectTo:'/mobile/connect?id='+pair.id});
}
export async function mobileApprove(data:FormData) {
  const session=await requireUser(),pair=pairInfo(db(),data.get('id'));
  if(data.get('confirm')!=='yes')throw new Error('Ellenőrizd a telefonon megjelenő kódot.');
  approvePair(db(),pair.id,session.user!.email!);
  revalidatePath('/mobile/connect');
}
export async function mobileRevoke(data:FormData) {
  await requireAdmin();const id=data.get('id');
  if(typeof id!=='string' || !db().prepare('SELECT id FROM mobile_devices WHERE id=?').get(id))throw new Error('Ismeretlen eszköz.');
  revokeDevice(db(),id);revalidatePath('/config');revalidatePath('/mobile');
}
