import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { pushConfigured } from '@/lib/mobile/push';
import { mobileRevoke } from './actions';

export default async function MobileSettings() {
  await requireAdmin();
  const devices=db().prepare('SELECT id,email,label,last_seen,expires_at,push_enabled,device_type FROM mobile_devices WHERE revoked=0 ORDER BY email,created_at DESC').all() as {id:string;email:string;label:string;last_seen:number;expires_at:number;push_enabled:number;device_type:'android'|'browser'}[];
  const date=(value:number)=>new Date(value).toLocaleString('hu-HU',{timeZone:'Europe/Budapest'});
  const states:Record<string,string>={queued:'Sorban',retry:'Újrapróbálásra vár',sending:'Küldés alatt',sent:'FCM elfogadta',failed:'Sikertelen',uncertain:'Bizonytalan, nincs automatikus újraküldés',expired:'Lejárt',cancelled:'Törölve'};
  return <section id="mobile" className="personal-section mobile-settings"><div className="section-heading"><h2>Eszközök / push <span>{devices.length}</span></h2><a href="/mobile/download" className="secondary-button">Android APK letöltése</a></div>
    <p>Szerver küldés: {pushConfigured() ? 'bekapcsolva' : 'még nincs beállítva'}. Androidra és feliratkozott böngészőre küldünk.</p>
    <p>Csak a kapcsolódás után keletkező, a saját értesítési beállításoknak megfelelő új eseményeket küldjük. A régi alapállapot nem generál push üzeneteket.</p>
    {!devices.length && <p>Még nincs párosított telefon. Az Android-appban indítsd el a böngészős párosítást.</p>}
    {devices.map(device=>{
      const jobs=db().prepare('SELECT state,error,created_at FROM mobile_push_outbox WHERE device_id=? ORDER BY created_at DESC LIMIT 5').all(device.id) as {state:string;error:string|null;created_at:number}[];
      return <section className="pokemon-panel" key={device.id}><h3>{device.label} · {device.device_type==='browser'?'Böngésző':'Android'}</h3><p>{device.email}</p><p>Push: {device.push_enabled ? 'engedélyezve' : 'kikapcsolva'} · Utolsó kapcsolat: {date(device.last_seen)}</p><p>Hozzáférés lejár: {date(device.expires_at)}</p><form action={mobileRevoke}><input name="id" type="hidden" value={device.id}/><button className="secondary-button">Eszköz és push visszavonása</button></form>
        <details><summary>Legutóbbi push küldések ({jobs.length})</summary>{jobs.map((job,index)=><p key={index}>{date(job.created_at)} · {states[job.state] || job.state}{job.error ? ' · '+job.error : ''}</p>)}{!jobs.length && <p>Még nem volt push küldés.</p>}</details>
      </section>;
    })}
    <p className="footnote">A visszavonás az adott eszköz pushát tiltja le; a már folyamatban lévő küldés nem vonható vissza. A böngésző értesítési jogosultsága az oldal beállításaiban, az Androidé a telefon beállításaiban módosítható.</p>
  </section>;
}
