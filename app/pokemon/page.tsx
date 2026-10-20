import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { pokemonSnapshot } from "@/lib/pokemon/data";
import DashboardSidebar from "../dashboard-sidebar";
import PokemonPanel from "../pokemon-panel";
import { isOpenCodeOwner } from '@/lib/opencode-access';
import { canAccess, homeForRole } from '@/lib/users';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Pokémon figyelő · Wydrian'};

export default async function PokemonPage() {
  const session=await requireUser().catch(()=>null);
  if(!session)redirect('/');
  if(!canAccess(session.role,'pokemon'))redirect(homeForRole(session.role));
  return <div className="dashboard-shell">
    <DashboardSidebar name={session.user?.name} active="pokemon" role={session.role!} openCode={isOpenCodeOwner(session.user?.email)}/>
    <main className="main-content pokemon-page">
      <section className="page-heading"><div><span className="eyebrow">POKÉMON TCG</span><h1>Pokémon figyelő</h1><p>{session.role!=='admin'&&<><strong>Pokémon olvasói hozzáférés.</strong> </>}Új elérhetőségek egy helyen. Webshoponként külön figyelés és beállítások.</p></div></section>
      <PokemonPanel initial={pokemonSnapshot(session.user!.email!,session.role!)}/>
      <p><a className="secondary-button" href="/mobile/download">Android APK letöltése</a></p>
      <footer className="main-footer">Wydrian Dashboard</footer>
    </main>
  </div>;
}
