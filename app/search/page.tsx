import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {globalSearch,searchQuery} from '@/lib/global-search';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import {canAccess,homeForRole} from '@/lib/users';
import DashboardSidebar from '../dashboard-sidebar';
import '../tools.css';
import SearchContent from './search-content';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Keresés · Wydrian',robots:{index:false,follow:false}};
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string|string[]}>}){
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');
  const params=await searchParams,query=searchQuery(params.q);
  if(session.role==='admin')redirect('/'+(query?'?q='+encodeURIComponent(query):'')+'#dashboard-search');
  if(!canAccess(session.role,'mobile-self'))redirect(homeForRole(session.role));
  const results=globalSearch(db(),session.user!.email!,query);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="search" role={session.role!} openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content">
    <section className="page-heading"><div><span className="eyebrow">JOGOSULTSÁGKEZELT KERESÉS</span><h1>Keresés</h1><p>Csak a szerepkörödnek elérhető modulokban. Nem keresünk fájltartalomban, titkokban vagy megosztási tokenekben.</p></div></section>
    <section className="tools-panel"><SearchContent query={query} results={results}/></section>
  </main></div>;
}
