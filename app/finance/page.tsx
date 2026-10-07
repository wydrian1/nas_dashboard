import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { readFinanceSnapshot } from '@/lib/finance/store';
import { validMonth } from '@/lib/finance/types';
import DashboardSidebar from '../dashboard-sidebar';
import FinanceWorkspace from './finance-workspace';
import './finance.css';
import { financeMarket } from '@/lib/finance/market';
import { readLego } from '@/lib/finance/lego';
import { readPokemonCollection } from '@/lib/finance/pokemon-collection';
import { isOpenCodeOwner } from '@/lib/opencode-access';
import {homeForRole} from '@/lib/users';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Pénzügy · Wydrian',robots:{index:false,follow:false}};
export default async function FinancePage({searchParams}:{searchParams:Promise<{month?:string}>}) {
  const session=await requireUser().catch(()=>null);
  if(!session)redirect('/');
  if(session.role!=='admin')redirect(homeForRole(session.role));
  const query=await searchParams;let month:string|undefined;
  try{month=query.month ? validMonth(query.month) : undefined;}catch{redirect('/finance');}
  const snapshot=readFinanceSnapshot(db(),month),latest=month ? readFinanceSnapshot(db()) : snapshot;
  const market=await financeMarket(),lego=readLego(db()),pokemon=readPokemonCollection(db());
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="finance" openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content finance-page">
    <section className="page-heading"><div><span className="eyebrow">VAGYON ÉS GYARAPODÁS</span><h1>Pénzügy</h1><p>Havi állapotok, követhető változások, éves kamatfordulók. Privát, csak adminoknak.</p></div></section>
    <FinanceWorkspace snapshot={snapshot} latest={latest} lego={lego} pokemon={pokemon} market={market}/>
    <footer className="main-footer">Wydrian Dashboard</footer>
  </main></div>;
}
