"use server";
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { addFinanceAccount, saveFinanceMonth } from '@/lib/finance/store';
import { FinanceInputError } from '@/lib/finance/types';
import type { FinanceAccount } from '@/lib/finance/types';
import { formNeedsUsd, hufFinanceForm, validRateDate } from '@/lib/finance/market-types';
import { loadExchangeRates } from '@/lib/finance/market';
import type { ActionResult } from '@/lib/personal-types';

export async function saveMonth(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  let email:string;
  try{const session=await requireAdmin();email=session.user!.email!;}catch{return {error:'A pénzügyi adatokhoz admin jogosultság szükséges.'};}
  try{
    const accounts=db().prepare('SELECT * FROM finance_accounts').all() as FinanceAccount[];
    const rates=formNeedsUsd(data,accounts) ? await loadExchangeRates(validRateDate(data.get('fx_date'))) : null;
    const normalized=hufFinanceForm(data,accounts,rates);
    const month=saveFinanceMonth(db(),normalized,email,new Date().toISOString(),rates ? {date:rates.date,usdHuf:rates.usdHuf} : undefined);
    revalidatePath('/finance');return {success:`${month}: havi állapot elmentve Ft-ban. Az előzmény és a módosítási napló megmaradt.`};
  }
  catch(error){return {error:error instanceof FinanceInputError ? error.message : 'A mentés nem sikerült. Az adatokat nem írtam felül.'};}
}
export async function addAccount(_previous:ActionResult,data:FormData):Promise<ActionResult> {
  let email:string;
  try{const session=await requireAdmin();email=session.user!.email!;}catch{return {error:'A pénzügyi adatokhoz admin jogosultság szükséges.'};}
  try{addFinanceAccount(db(),data,email,'manual-'+randomUUID());revalidatePath('/finance');return {success:'Új tétel létrehozva; az üres/további tételeknél töltheted ki az összegét.'};}
  catch(error){return {error:error instanceof FinanceInputError ? error.message : 'Az új tétel nem menthető.'};}
}
