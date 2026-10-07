import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {homeForRole} from '@/lib/users';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import {hostingId} from '@/lib/file-hosting/types';
import {listing,signHostingLink} from '@/lib/file-hosting/store';
import DashboardSidebar from '../dashboard-sidebar';
import FileManager from './file-manager';
import './files.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Fájlok · Wydrian',robots:{index:false,follow:false}};
export default async function FilesPage({searchParams}:{searchParams:Promise<{folder?:string|string[]}>}) {
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');if(session.role!=='admin')redirect(homeForRole(session.role));
  const params=await searchParams;let folder:string|null=null;
  try{if(params.folder!==undefined)folder=hostingId(params.folder);}catch{redirect('/files');}
  let initial;try{initial=listing(db(),folder);}catch(error){if(folder)redirect('/files');throw error;}
  const links=initial.links.map(link=>({...link,url:link.revoked_at===null&&process.env.AUTH_SECRET?'/s/'+signHostingLink(link.id,process.env.AUTH_SECRET):null}));
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="files" role={session.role} openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content files-page">
    <header className="topbar"><a href="/">← Vissza a dashboardra</a><span className="domain"><i/>nas.wydrian.hu</span></header>
    <section className="page-heading"><div><span className="eyebrow">PRIVÁT TÁROLÓ · NYILVÁNOS MEGOSZTÁS</span><h1>Fájlok</h1><p>Admin feltöltés és mappakezelés · fájlonként legfeljebb 1 GB.</p></div></section>
    <FileManager initial={{...initial,links}}/>
    <footer className="main-footer">Wydrian Dashboard</footer>
  </main></div>;
}
