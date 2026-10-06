import { requireUser } from '@/auth';
import { redirect } from 'next/navigation';
import {homeForRole} from '@/lib/users';

export const dynamic='force-dynamic';
export default async function Mobile() {
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');
  if(session.role!=='admin')redirect(homeForRole(session.role));
  redirect('/config#mobile');
}
