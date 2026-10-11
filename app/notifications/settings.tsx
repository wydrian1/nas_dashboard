import {redirect} from 'next/navigation';
import {requireUser} from '@/auth';
import {db} from '@/lib/db';
import {homeForRole} from '@/lib/users';
import {deliveryPreferences,watchRules} from '@/lib/mobile/preferences';
import {pushHistory} from '@/lib/mobile/history';
import {SHOP_IDS,SHOP_NAMES} from '@/lib/pokemon/types';
import {ActionForm,ActionButton} from '../action-form';
import {saveDelivery,addWatch,removeWatch} from './actions';
import LocalSections,{LocalSection} from '../local-sections';
import '../tools.css';
const time=(minute:number)=>String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
const labels:Record<string,string>={queued:'Várakozik',sending:'Beküldés alatt',sent:'FCM elfogadta',retry:'Újrapróbálásra vár',failed:'Küldési hiba',uncertain:'Bizonytalan beküldés',cancelled:'Törölve',expired:'Lejárt',muted:'Csendes időszak miatt nem küldve'};
export default async function NotificationSettings(){
  const session=await requireUser();if(session.role==='info-reader')redirect(homeForRole(session.role));
  const email=session.user!.email!,preferences=deliveryPreferences(db(),email),rules=watchRules(db(),email),history=pushHistory(db(),email);
  return <section id="notifications"><div className="section-heading"><h2>Értesítési központ</h2></div><p>Csak a saját fiókod telefonjait érinti. <a href="/pokemon">Boltonkénti értesítések →</a></p>
    <LocalSections page="notifications"><LocalSection sectionId="delivery" label="Küldési szabályok"><section className="tools-panel"><h2>Küldési szabályok</h2><ActionForm action={saveDelivery} className="tools-form">
      <label><input name="quiet_enabled" type="checkbox" defaultChecked={!!preferences.quiet_enabled}/> Csendes időszak a termékértesítésekhez</label>
      <label>Kezdete<input name="quiet_start" type="time" required defaultValue={time(preferences.quiet_start)}/></label><label>Vége<input name="quiet_end" type="time" required defaultValue={time(preferences.quiet_end)}/></label>
      <label>Termékértesítések<select name="digest_minutes" defaultValue={preferences.digest_minutes}><option value="0">Azonnal, termékenként</option><option value="5">5 perces összefoglaló</option><option value="10">10 perces összefoglaló</option></select></label>
      <label><input name="watchlist_only" type="checkbox" defaultChecked={!!preferences.watchlist_only}/> Csak a figyelőlistámnak megfelelő termékek</label><ActionButton className="primary-button">Mentés</ActionButton>
    </ActionForm><p className="footnote">Budapesti idő, a nyári/téli időszámítással. Csendes időben nem küldünk termékpush-t és később sem pótoljuk elavult készletként. A feladat- és kiadásértesítések nem változnak. Az összefoglaló a Pokémon-oldalt nyitja meg. Üres, bekapcsolt figyelőlista nem kér termékértesítést.</p></section></LocalSection>
    <LocalSection sectionId="watchlist" label="Figyelőlista"><section className="tools-panel"><h2>Személyes figyelőlista</h2><ActionForm action={addWatch} className="tools-form">
      <label>Termékcsalád / névrészlet<input name="query" maxLength={80} placeholder="Például: booster box"/></label><label>Webshop<select name="shop_id"><option value="">Bármelyik bolt</option>{SHOP_IDS.map(id=><option key={id} value={id}>{SHOP_NAMES[id]}</option>)}</select></label>
      <label>Nyelv<select name="language"><option value="any">Bármelyik / ismeretlen</option><option value="english">Angol, ha a név jelöli</option><option value="japanese">Japán, ha a név jelöli</option></select></label><label>Legfeljebb ennyi Ft<input name="max_huf" type="number" min="1" max="10000000" step="1"/></label><ActionButton className="primary-button">Szabály hozzáadása</ActionButton>
    </ActionForm><p className="footnote">Egy szabály minden megadott feltételének teljesülnie kell; több szabály közül egy találat elég. Hiányzó árral nem teljesül árhatár, ismeretlen nyelvet nem találgatunk. A figyelőlista csak fent bekapcsolva szűri a pushokat.</p>
    {rules.map(rule=><div className="tools-row" key={rule.id}><span>{rule.query||'Bármelyik név'} · {rule.shop_id&&SHOP_IDS.includes(rule.shop_id as typeof SHOP_IDS[number])?SHOP_NAMES[rule.shop_id as typeof SHOP_IDS[number]]:'Bármelyik bolt'} · {rule.language==='english'?'Angol':rule.language==='japanese'?'Japán':'Bármelyik nyelv'} · {rule.max_huf===null?'Nincs árhatár':rule.max_huf.toLocaleString('hu-HU')+' Ft'}</span><ActionForm action={removeWatch}><input type="hidden" name="id" value={rule.id}/><ActionButton>Eltávolítás</ActionButton></ActionForm></div>)}{!rules.length&&<p>Nincs személyes szabály.</p>}</section></LocalSection>
    <LocalSection sectionId="history" label="Előzmények"><section className="tools-panel"><h2>Küldési előzmények</h2><p className="footnote">Legutóbbi 100 telefononkénti bejegyzés. Az „FCM elfogadta” nem bizonyítja a telefonos megjelenítést vagy megnyitást. Összefoglalónál több termék közös beküldéshez tartozhat.</p>{history.map(item=><article className="tools-row" key={item.id}><div><strong>{item.title}</strong><p>{labels[item.state]||'Ismeretlen állapot'} · {new Intl.DateTimeFormat('hu-HU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Budapest'}).format(item.created_at)}</p></div></article>)}{!history.length&&<p>Még nincs küldési előzmény.</p>}</section></LocalSection></LocalSections>
  </section>;
}
