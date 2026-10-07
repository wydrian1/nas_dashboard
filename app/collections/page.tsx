import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { homeForRole } from '@/lib/users';
import { isOpenCodeOwner } from '@/lib/opencode-access';
import { readLego } from '@/lib/finance/lego';
import { readPokemonCollection } from '@/lib/finance/pokemon-collection';
import DashboardSidebar from '../dashboard-sidebar';
import LegoInventory from './lego-inventory';
import PokemonInventory from './pokemon-inventory';
import '../finance/finance.css';
import LocalSections,{LocalSection} from '../local-sections';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Gyűjtemények · Wydrian',robots:{index:false,follow:false}};
export default async function CollectionsPage() {
  const session=await requireUser().catch(()=>null);
  if(!session)redirect('/');
  if(session.role!=='admin')redirect(homeForRole(session.role));
  const database=db(),lego=readLego(database),pokemon=readPokemonCollection(database);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="collections" role={session.role} openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content finance-page">
    <header className="topbar"><a href="/">← Vissza a dashboardra</a><span className="domain"><i/>nas.wydrian.hu</span></header>
    <section className="page-heading"><div><span className="eyebrow">BEKERÜLÉSI NYILVÁNTARTÁS</span><h1>Gyűjtemények</h1><p>LEGO és Pokémon · vásárlások, darabszámok és bekerülési értékek. Privát, csak adminoknak.</p></div></section>
    <p className="footnote"><a href="/finance#collection-growth">Gyűjtemény gyarapodás a Pénzügy oldalon →</a></p>
    <LocalSections page="collections"><LocalSection sectionId="lego" label="LEGO"><LegoInventory snapshot={lego}/></LocalSection><LocalSection sectionId="pokemon" label="Pokémon"><PokemonInventory snapshot={pokemon}/></LocalSection></LocalSections>
    <footer className="main-footer">Wydrian Dashboard</footer>
  </main></div>;
}
