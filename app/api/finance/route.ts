import { requireAdmin, authError } from '@/auth';
import { db } from '@/lib/db';
import { readFinanceSnapshot } from '@/lib/finance/store';
import { validMonth } from '@/lib/finance/types';

export const runtime='nodejs';
export async function GET(request:Request) {
  try{await requireAdmin();}catch(error){return authError(error);}
  const month=new URL(request.url).searchParams.get('month');
  try{
    const snapshot=readFinanceSnapshot(db(),month ? validMonth(month) : undefined);
    if(month && !snapshot.selected)return Response.json({error:'Nincs rögzített állapot ehhez a hónaphoz.'},{status:404,headers:{'Cache-Control':'private, no-store'}});
    return Response.json({...snapshot,currency:'HUF',amountScale:100},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Érvénytelen hónap.'},{status:400,headers:{'Cache-Control':'private, no-store'}});}
}
