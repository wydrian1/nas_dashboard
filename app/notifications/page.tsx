import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {homeForRole} from '@/lib/users';
import DashboardSidebar from '../dashboard-sidebar';
import NotificationSettings from './settings';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Értesítési központ · Wydrian',robots:{index:false,follow:false}};
export default async function NotificationsPage(){
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');
  if(session.role==='admin')redirect('/config#notifications');
  if(session.role!=='pokemon-reader')redirect(homeForRole(session.role));
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="notifications" role={session.role}/><main className="main-content">
    <section className="page-heading"><div><span className="eyebrow">SAJÁT ÉRTESÍTÉSEK</span><h1>Értesítési központ</h1><p>Személyes készletértesítések és küldési előzmények.</p></div></section>
    <NotificationSettings/>
  </main></div>;
}
