import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/auth';
import { isOpenCodeOwner } from '@/lib/opencode-access';
import {homeForRole} from '@/lib/users';
import DashboardSidebar from '../dashboard-sidebar';
import OpenCodeFrame from './opencode-frame';
import './opencode.css';
import {headers} from 'next/headers';
import {dashboardRequestOrigin} from '@/lib/dashboard-origin';
import LocalSections,{LocalSection} from '../local-sections';
import OpenCodePreviews from './previews';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'OpenCode · Wydrian',robots:{index:false,follow:false}};
export default async function OpenCodePage() {
  const session=await requireUser().catch(()=>null);
  if(!session)redirect('/');
  if(session.role!=='admin')redirect(homeForRole(session.role));
  if(!isOpenCodeOwner(session.user?.email))redirect('/');
  // Keep the original tool lease scoped to nas.wydrian.hu; never share dashboard cookies across hosts.
  if(process.env.AUTH_MULTI_DOMAIN==='true'&&dashboardRequestOrigin(await headers())==='https://wydrian.hu')redirect('https://nas.wydrian.hu/opencode');
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="opencode" openCode/><main className="main-content opencode-page">
    <section className="page-heading"><div><span className="eyebrow">PRIVÁT FEJLESZTŐI MUNKATERÜLET</span><h1>OpenCode</h1><p>Az eredeti OpenCode-felület. Kizárólag a tulajdonosnak, a dashboard belépése mögött.</p></div></section>
    <LocalSections page="opencode"><LocalSection sectionId="workspace" label="OpenCode"><OpenCodeFrame enabled={process.env.OPENCODE_WEB_ENABLED==='true'}/></LocalSection><LocalSection sectionId="previews" label="Előnézetek"><OpenCodePreviews/></LocalSection></LocalSections>
    <p className="footnote">Az itt végzett műveletek fájlokat módosíthatnak és parancsokat futtathatnak a szerveren. A hozzáférést rövid élettartamú, HttpOnly cookie védi; szerverjelszó nem kerül a böngészőbe vagy az appba.</p>
  </main></div>;
}
