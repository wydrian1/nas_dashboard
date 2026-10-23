import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {homeForRole} from '@/lib/users';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import {readTravelItinerary,TRAVEL_SANDBOX} from '@/lib/travel';
import DashboardSidebar from '../dashboard-sidebar';
import './travel.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Utazás · Wydrian',robots:{index:false,follow:false}};
export default async function TravelPage(){
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');
  if(session.role!=='admin')redirect(homeForRole(session.role));
  const available=readTravelItinerary()!==null;
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="travel" role={session.role} openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content travel-page">
    <section className="page-heading"><div><span className="eyebrow">ÚTITERV</span><h1>Utazás</h1><p>A mentett utazási terv, az eredeti dokumentum elrendezésével.</p></div>{available&&<a className="travel-open" href="/api/travel/itinerary" target="_blank" rel="noopener noreferrer">Megnyitás külön lapon ↗</a>}</section>
    {available?<iframe className="travel-document" src="/api/travel/itinerary" title="Utazási útiterv" sandbox={TRAVEL_SANDBOX} referrerPolicy="no-referrer"/>:<section className="travel-empty"><h2>Még nincs útiterv</h2><p>Az útiterv importálása után itt jelenik meg a dokumentum.</p></section>}
    <footer className="main-footer">Wydrian Dashboard</footer>
  </main></div>;
}
