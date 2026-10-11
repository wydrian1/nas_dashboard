import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {homeForRole} from '@/lib/users';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import {operationalHealth} from '@/lib/operational-health';
import {serviceStatuses} from '@/lib/services';
import {publishedApk} from '@/lib/mobile/apk-release';
import DashboardSidebar from '../dashboard-sidebar';
import LocalSections,{LocalSection} from '../local-sections';
import '../tools.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Rendszer állapota · Wydrian',robots:{index:false,follow:false}};
const date=(value:string|number|null)=>value===null?'Nem ellenőrizhető':new Intl.DateTimeFormat('hu-HU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Budapest'}).format(new Date(value));
export default async function SystemPage(){
  const session=await requireUser().catch(()=>null);if(!session)redirect('/');if(session.role!=='admin'||!isOpenCodeOwner(session.user?.email))redirect(homeForRole(session.role!));
  const health=operationalHealth(db(),session.user!.email!),services=process.env.SERVICE_PROBES_ENABLED==='false'?[]:await serviceStatuses(),apk=await publishedApk().then(value=>value.release.versionName).catch(()=>null);
  const issues=health.shops.filter(item=>item.stale&&item.status!=='paused');
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="system" role="admin" openCode/><main className="main-content">
    <section className="page-heading"><div><span className="eyebrow">TULAJDONOSI ÁLLAPOTNÉZET</span><h1>Rendszer állapota</h1><p>{issues.length||!health.workerAlive||health.backup.state!=='ok'||apk===null||services.some(service=>service.state==='offline')?'Van ellenőrizendő állapot.':'Az ellenőrzött háttérfunkciók rendben.'} · <a href="/system">Állapot újraolvasása</a></p></div></section>
    <LocalSections page="system"><LocalSection sectionId="worker" label="Háttérfigyelő"><section className="tools-panel"><h2>Háttérfigyelő és webshopok</h2><p className={'tools-status '+(health.workerAlive?'':'error')}>{health.workerAlive?'Friss életjel':'Életjel hiányzik vagy elavult'}</p><p>Utolsó életjel: {date(health.heartbeat)}</p>{health.shops.map(item=><div className="tools-row" key={item.id}><div><a href={'/pokemon#shop-'+item.id}>{item.name}</a><p>{item.status} · {item.reason}</p><small>Utolsó siker: {date(item.checkedAt)} · következő próbálkozás: {date(item.nextScan)}</small></div><span className={'tools-status '+(item.stale?'warning':'')}>{item.stale?'Ellenőrizendő':'Friss'}</span></div>)}</section></LocalSection>
    <LocalSection sectionId="backup" label="Mentés"><section className="tools-panel"><h2>Mentés és visszaállítás</h2><strong className={'tools-status '+(health.backup.state==='ok'?'':'warning')}>{health.backup.message}</strong><p>Helyi, visszaállítás-ellenőrzött mentés készült: {date(health.backup.localAt)}</p><p>Felhőbe feltöltés és hash-ellenőrzés: {date(health.backup.cloudAt)}</p><p>Felhőből letöltött, önálló recovery kit próba: {date(health.backup.restoreAt)}</p><p className="footnote">A napi mentés 36 óra után, a teljes felhő-visszaállítási próba 30 nap után elavult. Hiányzó/olvashatatlan bizonyíték nem siker. A nézet nem indít mentést vagy visszaállítást, és nem olvas recovery-kulcsot.</p></section></LocalSection>
    <LocalSection sectionId="release" label="Kiadás és push"><section className="tools-panel"><h2>Kiadás és push</h2><p>Éles web: {health.webVersion} · publikált APK: {apk??'Nem ellenőrizhető'}</p><p>Legutóbbi hitelesített sikeres élesítés: {health.release?.commit?.slice(0,12)??'Nincs bizonyíték'} · {date(health.release?.at??null)}</p><p className="footnote">A sikeres broker-eredmény után rögzített kiadási bejegyzés, nem tetszőleges fájlból olvasott Git-hash.</p><h3>Pushállapotok · elmúlt 24 óra</h3>{health.push.map(item=><p key={item.state}>{item.state}: {item.count}</p>)}{!health.push.length&&<p>Nincs bejegyzés.</p>}<p className="footnote">A sent állapot FCM-elfogadást jelent, nem eszközön megjelenítést. Részletek a <a href="/config#notifications">saját értesítési központban</a>.</p></section></LocalSection>
    <LocalSection sectionId="services" label="Szolgáltatások"><section className="tools-panel"><h2>Meglévő szolgáltatáspróbák</h2>{services.map(service=><p key={service.name}>{service.name}: {service.state} · {service.latency} ms</p>)}<p className="footnote">Ugyanazok a fix, olvasási HTTP-próbák, mint a dashboardon. Nem szolgáltatás-újraindító vagy adminparancs.</p></section></LocalSection></LocalSections>
  </main></div>;
}
