import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {globalSearch} from '@/lib/global-search';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import DashboardSidebar from '../dashboard-sidebar';
import '../tools.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Keresés · Wydrian',robots:{index:false,follow:false}};
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string|string[]}>}){
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');
  const params=await searchParams,query=typeof params.q==='string'&&params.q.length<=80?params.q:'',results=globalSearch(db(),session.user!.email!,query);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="search" role={session.role!} openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content">
    <section className="page-heading"><div><span className="eyebrow">JOGOSULTSÁGKEZELT KERESÉS</span><h1>Keresés</h1><p>Csak a szerepkörödnek elérhető modulokban. Nem keresünk fájltartalomban, titkokban vagy megosztási tokenekben.</p></div></section>
    <section className="tools-panel"><form className="tools-form" method="get"><label>Keresett szöveg<input name="q" type="search" minLength={2} maxLength={80} required defaultValue={query}/></label><button className="primary-button">Keresés</button></form>
    {query.trim().length>=2?<><p role="status">{results.length} találat · legfeljebb 50, modulonként legfeljebb 10.</p>{results.map((result,index)=><a className="search-result" href={result.href} key={index}><small>{result.kind}</small><strong> · {result.title}</strong><p>{result.preview}</p></a>)}</>:<p>Legalább két karakterrel keress.</p>}</section>
  </main></div>;
}
