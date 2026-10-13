import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/auth';
import { nullpontUrl } from '@/lib/nullpont-link';
import DashboardSidebar from '../dashboard-sidebar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'NULLPONT · Wydrian' };
export default async function AdventurePage() {
  const session = await requireUser().catch(() => null);
  if (!session) redirect('/');
  const destination = nullpontUrl(process.env.NULLPONT_URL);
  if (destination) redirect(destination);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} role={session.role!}/><main className="main-content">
    <section className="page-heading"><div><span className="eyebrow">ÖNÁLLÓ ALKALMAZÁS</span><h1>A NULLPONT külön költözik</h1><p>A játék már nem a dashboard része. Az önálló alkalmazás címének beállítása folyamatban van. A korábbi mentések nem törlődnek.</p></div></section>
  </main></div>;
}
