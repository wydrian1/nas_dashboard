import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { loadGame } from '@/lib/adventure/store';
import { isOpenCodeOwner } from '@/lib/opencode-access';
import DashboardSidebar from '../dashboard-sidebar';
import AdventureGame from './game';
import './adventure.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'NULLPONT · Wydrian' };
export default async function AdventurePage() {
  const session = await requireUser().catch(() => null);
  if (!session) redirect('/');
  const game = loadGame(db(), session.user!.email!);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} role={session.role!} active="adventure" openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content adventure-page">
    <section className="page-heading"><div><span className="eyebrow">SZÖVEGES KALAND · JÁTSZHATÓ NYITÁNY</span><h1>NULLPONT</h1><p>Az emlékeid hiányoznak. A következményeik nem.</p></div></section>
    <AdventureGame initialGame={game}/>
    <footer className="main-footer">Wydrian Dashboard · Nincs halál, nincs végleges elakadás.</footer>
  </main></div>;
}
