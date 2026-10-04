import { requireUser } from "@/auth";
import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { articles } from "@/lib/db";
import { serviceStatuses } from "@/lib/services";
import ServiceCards from "./service-cards";
import { systemSnapshot } from "@/lib/system-info";
import SystemCards from "./system-cards";
import { personalData } from "@/lib/personal-data";
import { QuickLinks } from "./personal-sections";
import WeatherCard from "./weather-card";
import DashboardSidebar from "./dashboard-sidebar";
import { isOpenCodeOwner } from '@/lib/opencode-access';

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireUser().catch(()=>null);
  if(session?.role==='pokemon-reader')redirect('/pokemon');
  const allowed = session?.role==='admin';
  const { error } = await searchParams;
  if (!allowed) return <main className="login-shell">
    <div className="login-card"><img className="brand-mark" src="/brand-w-modules.svg" alt="Wydrian" width="60" height="60"/><span className="eyebrow">SZEMÉLYES VEZÉRLŐKÖZPONT</span>
    <h1>Minden egy helyen.</h1><p>Szolgáltatások, hírek és a saját digitális otthonod.<br />Biztonságosan, bárhonnan.</p>
    <form action={login}><button className="google-button"><span className="google-g">G</span>Folytatás Google-fiókkal<span>→</span></button></form>
    {error && <p className="error">A belépés nem sikerült. Csak az admin által engedélyezett Google-fiók használható.</p>}
    <div className="login-footer"><span className="tiny-dot" />Privát hozzáférés · nas.wydrian.hu</div></div>
  </main>;

  const [services, system] = await Promise.all([serviceStatuses(), systemSnapshot()]);
  const unread = articles().filter(article => !article.is_read).length;
  const personal = personalData();
  return <div className="dashboard-shell"><DashboardSidebar name={session?.user?.name} unread={unread} openCode={isOpenCodeOwner(session?.user?.email)}/><main className="main-content" id="overview"><header className="topbar"><span>Az otthonod, online.</span><span className="domain"><i />nas.wydrian.hu</span></header>
    <section className="page-heading"><div><h1>Dashboard</h1></div><span className="date">{new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", timeZone: "Europe/Budapest" }).format(new Date())}</span></section>
    <section><div className="section-heading"><h2>Szolgáltatások <span>03</span></h2><span className="subtle">Élő állapot</span></div><ServiceCards initial={services} /></section>
    <QuickLinks links={personal.links}/>
    <WeatherCard location={personal.location}/>
    <section className="system-section" id="system"><div className="section-heading"><h2>Rendszerállapot</h2><span className="subtle">Windows PC</span></div><SystemCards initial={system} /></section>
    <footer className="main-footer">WYDRIAN DASHBOARD<span>Saját tér. Saját szabályok.</span></footer>
  </main></div>;
}
