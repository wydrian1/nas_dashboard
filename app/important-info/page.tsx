import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {canAccess,homeForRole} from '@/lib/users';
import {readImportantInfo,readLatestInfoFinance} from '@/lib/important-info/store';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import DashboardSidebar from '../dashboard-sidebar';
import ImportantInfoEditor from './editor';
import ImportantInfoFinance from './finance';
import './info.css';
import LocalSections,{LocalSection} from '../local-sections';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Fontos infók · Wydrian',robots:{index:false,follow:false}};
export default async function ImportantInfoPage(){
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');
  if(!canAccess(session.role,'important-info'))redirect(homeForRole(session.role));
  const document=readImportantInfo(db(),session.user!.email!),finance=readLatestInfoFinance(db(),session.user!.email!);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="important-info" role={session.role!} openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content important-info-page">
    <header className="topbar">{session.role==='admin'?<a href="/">← Vissza a dashboardra</a>:<span>Fontos infók · csak olvasás</span>}<span className="domain"><i/>nas.wydrian.hu</span></header>
    <section className="page-heading"><div><span className="eyebrow">FONTOS TUDNIVALÓK</span><h1>Fontos infók</h1><p>Hasznos információk és a legutóbbi mentett havi pénzügyi állapot.</p></div></section>
    <LocalSections page="important-info"><LocalSection sectionId="document" label="Tudnivalók"><section className="info-card info-document"><div className="section-heading"><h2>Tudnivalók</h2>{document.updated_at&&<small>Mentve: {new Intl.DateTimeFormat('hu-HU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Budapest'}).format(new Date(document.updated_at))}</small>}</div>
      {session.role==='admin'?<ImportantInfoEditor document={document}/>:document.html?<div className="info-rich-text" dangerouslySetInnerHTML={{__html:document.html}}/>:<p>Még nincs rögzített fontos információ.</p>}
    </section></LocalSection><LocalSection sectionId="finance" label="Pénzügyi állapot"><ImportantInfoFinance finance={finance}/></LocalSection></LocalSections>
    <footer className="main-footer">Wydrian Dashboard</footer>
  </main></div>;
}
