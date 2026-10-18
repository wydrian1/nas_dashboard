"use client";
import { useEffect, useState } from "react";
import { ActionForm, ActionButton } from "./action-form";
import { savePokemonSettings, requestPokemonScan, savePokemonNotifications } from "./pokemon-actions";
import type { PokemonSnapshot } from "@/lib/pokemon/types";
import { filterPokemonTitles } from "./pokemon-search";
import {pokemonShortcutNeedsAttention} from './pokemon-shortcuts';
import LocalSections,{LocalSection} from './local-sections';

const date=(value:number|null)=>value ? new Intl.DateTimeFormat('hu-HU',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Budapest'}).format(value) : 'Még nem volt';
const price=(value:number|null)=>value===null ? 'Ár nem ismert' : value.toLocaleString('hu-HU')+' Ft';
const stateLabels:Record<string,string>={idle:'Várakozik',ok:'Rendben',scanning:'Vizsgálat folyamatban',paused:'Szüneteltetve',warning:'Megerősítésre vár',error:'Technikai vizsgálati hiba',maintenance:'Webshop-karbantartás',protected:'Hozzáférésvédelem',rate_limited:'Webshop-terhelési korlát'};
const eventLabels:Record<string,string>={new:'Új elérhető termék',restock:'Újra elérhető',preorder:'Új előrendelés'};
export default function PokemonPanel({initial}:{initial:PokemonSnapshot}) {
  const [snapshot,setSnapshot]=useState(initial),[error,setError]=useState('');
  const [shopFilter,setShopFilter]=useState('all'),[kindFilter,setKindFilter]=useState('all');
  const [search,setSearch]=useState('');
  const admin=(snapshot.viewerRole || 'admin')==='admin';
  useEffect(()=>{setSnapshot(initial);},[initial]);
  useEffect(()=>{
    const controller=new AbortController();let running=false;
    async function refresh(){
      if(running || document.visibilityState==='hidden')return;
      running=true;
      try{
        const response=await fetch('/api/pokemon',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15_000)])});
        if(!response.ok)throw new Error();
        const value=await response.json();if(!controller.signal.aborted){setSnapshot(value);setError('');}
      }catch{if(!controller.signal.aborted)setError('Az állapotfrissítés nem sikerült; az utolsó ismert adatok láthatók.');}
      finally{running=false;}
    }
    const timer=setInterval(refresh,15_000);document.addEventListener('visibilitychange',refresh);
    return ()=>{clearInterval(timer);controller.abort();document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const shops=snapshot.shops.map(item=>({...item,products:filterPokemonTitles(item.products,search),events:filterPokemonTitles(item.events,search)}));
  const latest=filterPokemonTitles(snapshot.latestEvents,search).filter(event=>(shopFilter==='all' || event.shop_id===shopFilter) && (kindFilter==='all' || (kindFilter==='new' ? event.kind==='new' || event.kind==='preorder' : event.kind==='restock')));
  return <section id="pokemon" className="pokemon-section">
    <div className="page-shortcuts" role="navigation" aria-label="Ugrás a webshophoz">{snapshot.shops.map(({shop,health})=>{
      const attention=pokemonShortcutNeedsAttention(shop,health,snapshot.workerAlive),issue=attention?'Figyelési probléma: '+(health?.stale?health.reason:stateLabels[shop.status]||shop.status):undefined;
      return <a href={`#shop-${shop.id}`} key={shop.id} className={attention?'pokemon-shortcut-error':undefined} title={issue} aria-label={issue?shop.name+' – '+issue:undefined}>{shop.name}{attention&&<span className="pokemon-shortcut-indicator" aria-hidden="true">!</span>}</a>;
    })}</div>
    <label className="pokemon-search" htmlFor="pokemon-search">Keresés terméknévben<input id="pokemon-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Termék neve…" autoComplete="off"/></label>
    {error && <p role="alert" className="error">{error}</p>}
    <LocalSections page="pokemon"><LocalSection sectionId="latest" label="Legújabb elérhetőségek"><section className="pokemon-aggregate" aria-labelledby="pokemon-latest-title">
      <div className="section-heading"><h2 id="pokemon-latest-title">Legújabb elérhetőségek <span>Összes webshop</span></h2><span className="subtle">15 másodpercenként frissülő állapot</span></div>
      <div className="pokemon-overview">
        <div><strong>{shops.filter(item=>!item.health?.stale).reduce((sum,item)=>sum+item.products.length,0)}</strong><span>frissen ellenőrzött, a keresésnek megfelelő termék</span></div>
        <div><strong>{shops.filter(item=>item.health?.stale).reduce((sum,item)=>sum+item.products.length,0)}</strong><span>elavult, utolsó ismert készletadat</span></div>
        <div><strong>{snapshot.shops.filter(item=>item.shop.enabled).length} / {snapshot.shops.length}</strong><span>aktív webshopfigyelés</span></div>
        <div><strong>{snapshot.workerAlive ? 'Működik' : 'Nem érhető el'}</strong><span>önálló háttérfigyelő</span></div>
      </div>
      <div className="pokemon-aggregate-filters">
        <label>Webshop<select value={shopFilter} onChange={event=>setShopFilter(event.target.value)}><option value="all">Összes webshop</option>{snapshot.shops.map(item=><option key={item.shop.id} value={item.shop.id}>{item.shop.name}</option>)}</select></label>
        <label>Esemény<select value={kindFilter} onChange={event=>setKindFilter(event.target.value)}><option value="all">Minden elérhetőség</option><option value="new">Új termékek / előrendelések</option><option value="restock">Újra elérhető termékek</option></select></label>
      </div>
      <div className="pokemon-latest-grid">{latest.map(event=><article className="pokemon-latest-card" key={event.id}>
        {event.image && <img src={event.image} alt="" width="72" height="72" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}
        <div className="pokemon-latest-content"><div className="pokemon-latest-meta"><a className="pokemon-shop-badge" href={`#shop-${event.shop_id}`}>{event.shop_name}</a><time dateTime={new Date(event.occurred_at).toISOString()}>{date(event.occurred_at)}</time></div>
          <strong className="pokemon-latest-kind">{eventLabels[event.kind] || event.kind}</strong><a className="pokemon-latest-title" href={event.url} target="_blank" rel="noopener noreferrer">{event.title} ↗</a><span className="subtle">{price(event.price_huf)}</span>
          {event.stale&&<strong className="error">Elavult készletadat · a webshopban ellenőrizendő</strong>}
        </div>
      </article>)}</div>
       {!latest.length && <div className="pokemon-latest-empty"><strong>{snapshot.latestEvents.length ? 'Nincs a szűrésnek megfelelő esemény.' : 'Az elmúlt 24 órából nincs új, továbbra is elérhető termék.'}</strong><p>Az új termékek, előrendelések és visszakészletezések itt legfeljebb 24 óráig láthatók, amíg elérhetők.</p></div>}
       <p className="footnote">Az elmúlt 24 óra legfeljebb 60, továbbra is elérhető termékeseménye, legújabb elöl. A 24 órás határ vagy egy teljes, sikeres vizsgálatból megállapított hiány után a termék innen eltűnik; az előzménye megmarad. Az első alapállapot nem számít új eseménynek. Az ár és a készlet a webshopban ellenőrizendő.</p>
    </section></LocalSection>
    {shops.map(({shop,products,events,notifications,health})=>{
      const key=[shop.id,shop.enabled,shop.interval_minutes].join('-');
      const own=notifications || {enabled:1,notify_new:shop.notify_new,notify_restock:shop.notify_restock,notify_preorder:shop.notify_preorder};
      const ownKey=[shop.id,own.enabled,own.notify_new,own.notify_restock,own.notify_preorder].join('-');
      return <LocalSection sectionId={'shop-'+shop.id} label={shop.name} key={shop.id}><div className="pokemon-panel" id={`shop-${shop.id}`}>
      <div className="pokemon-shop-top"><div><span className="eyebrow">POKÉMON TCG</span><h3><a href={shop.url} target="_blank" rel="noopener noreferrer">{shop.name} ↗</a></h3><p>{shop.id==='alza' ? 'Mobil készletlista · aktív „Kosárba” gomb · kiegészítők is' : ['mythgames','rtcollectorsclub'].includes(shop.id) ? 'Elérhető = szerepel a készletszűrt listában · nincs külön kosárgomb-ellenőrzés' : 'Elérhető = aktív „Kosárba” gomb · előrendelések is'}</p></div><strong className="pokemon-status">{stateLabels[shop.status] || shop.status}</strong></div>
      <div className="pokemon-meta"><span>Utolsó siker: <strong>{date(shop.last_success)}</strong></span><span>Következő: <strong>{shop.enabled ? date(shop.next_scan) : 'Szünetel'}</strong></span><span>Worker: <strong>{snapshot.workerAlive ? 'Működik' : 'Nem érhető el'}</strong></span><span>Értesítés: {admin ? <a href="/config#mobile"><strong>Telefonos push</strong></a> : <strong>Telefonos push</strong>}</span></div>
      {health?.stale&&<p className="error" role="status"><strong>Elavult készletadat.</strong> {health.reason} A mentett terméklista csak az utolsó ismert állapot, nem jelenlegi készlet.</p>}
      {!shop.baseline_at && <p className="footnote">Az első teljes vizsgálat értesítés nélküli alapállapotot ment.</p>}
      {shop.id==='grandline' && <p className="footnote">A GrandLine készletszűrt címe robotoknak tiltott. A figyelő az engedett, nyilvános kategóriát olvassa, és helyben szűr az aktív kosárgombokra.</p>}
      {shop.id==='jateknet' && <p className="footnote">A JátékNet szűrős címe robotoknak tiltott. A figyelő az engedett teljes kategóriából választja ki a Pokémon-nevű termékeket, a webshop Pokémon-számlálójával ellenőrizve.</p>}
      {shop.id==='reflexshop' && <p className="footnote">A megadott „pokemon tcg” készletszűrt keresés teljes találati listáját követjük; az itt megjelenő általános kártyavédők is beletartoznak.</p>}
      {shop.id==='tcgfutar' && <p className="footnote">A teljes, fokozatosan betöltött kategóriát ellenőrizzük, nem csak a link negyedik nézetét. A „Nincs raktáron” kártya kosárgomb nélkül nem elérhető.</p>}
      {shop.id==='rtcollectorsclub' && <p className="footnote">A megadott rendezés és üres árszűrők robotoknak tiltottak; a figyelő csak az engedett készletszűrt kategóriát olvassa. A választott szabály szerint a listán szereplő termék elérhető.</p>}
      {shop.id==='cardverse' && <p className="footnote">A készlet-, kategória- és Pokémon TCG márkaszűrő egyezését és a teljes találatszámot is ellenőrizzük. Az ikon alakú kosárgomb „Kosárba” hozzáférhető felirata számít.</p>}
      {shop.id==='metagames' && <p className="footnote">Csak a készletes Pokémon-kategória, aktív „Kosárba” gombbal. A teljes lapozott listát és annak változatlan elejét/végét ellenőrizzük.</p>}
      {shop.id==='bloomrift' && <p className="footnote">Az összes angol Pokémon-termék teljes, lapozott kategóriáját ellenőrizzük. Csak az aktív „Kosárba” gombú termék elérhető; a „Nincs raktáron” és „Részletek” nem számít készletnek.</p>}
      {shop.id==='alza' && <p className="footnote">Alapból szüneteltetett böngészős forrás. A robots.txt ellenőrzését külön tulajdonosi kérésre kihagyjuk. Csak teljes egyoldalas listát fogadunk el; hozzáférésvédelem, nem igazolt üres lista vagy lapozás nem írja felül a mentett készletet.</p>}
      {shop.id==='regio' && <p className="footnote">Alapból szüneteltetett böngészős forrás. A robots.txt ellenőrzését külön kérésre kihagyjuk. A megadott Pokémon-keresést és Kártya kategóriát, a teljes találatszámot és minden görgetésre betöltődő kártyát ellenőrizzük. Csak a látható, aktív „Kosárba” gomb jelent készletet; az áruházi készletből és a terméknévből nem következtetünk rendelhetőségre vagy előrendelésre. Egyelőre legfeljebb 30 találatos, teljes egyoldalas keresés támogatott.</p>}
      {shop.last_error && <p role="alert" className="error">{shop.last_error}</p>}
      {admin && <div className="pokemon-controls"><ActionForm action={requestPokemonScan}><input type="hidden" name="shopID" value={shop.id}/><ActionButton>↻ Kézi vizsgálat</ActionButton></ActionForm></div>}
      <details className="pokemon-settings"><summary>Figyelés és értesítések beállítása</summary>{admin ? <ActionForm key={key} action={savePokemonSettings} className="pokemon-settings-form">
        <input type="hidden" name="shopID" value={shop.id}/>
        <label><input type="checkbox" name="enabled" defaultChecked={!!shop.enabled}/> Automatikus figyelés</label>
        <label>Gyakoriság (perc)<input name="interval" type="number" min="3" max="60" step="1" required defaultValue={shop.interval_minutes}/></label>
        <ActionButton className="primary-button">Mentés</ActionButton>
        <p className="footnote">Az automatikus figyelés és a gyakoriság közös, csak admin módosíthatja.</p>
      </ActionForm> : <p>Automatikus figyelés: {shop.enabled ? 'bekapcsolva' : 'szünetel'} · Gyakoriság: {shop.interval_minutes} perc. Ezt az admin állítja be.</p>}
      <ActionForm key={ownKey} action={savePokemonNotifications} className="pokemon-settings-form">
        <input type="hidden" name="shopID" value={shop.id}/>
        <label><input type="checkbox" name="notifications" defaultChecked={!!own.enabled}/> Kérek értesítést ebből a webshopból</label>
        {admin && <><label><input type="checkbox" name="new" defaultChecked={!!own.notify_new}/> Új elérhető termékek</label>
        <label><input type="checkbox" name="restock" defaultChecked={!!own.notify_restock}/> Újra elérhető termékek</label>
        <label><input type="checkbox" name="preorder" defaultChecked={!!own.notify_preorder}/> Előrendelések is</label></>}
        <ActionButton className="primary-button">Saját értesítések mentése</ActionButton>
        <p className="footnote">Csak a saját fiókod párosított telefonjait érinti. Más felhasználó pushai nem változnak; régi eseményeket nem küldünk visszamenőleg. A fogadás telefononként az app menüjében is kikapcsolható.</p>
      </ActionForm></details>
      <details className="pokemon-products"><summary>Elérhető termékek ({products.length})</summary><div className="pokemon-grid">{products.map(product=><article className="pokemon-product" key={product.external_id}>
        {product.image && <img src={product.image} alt="" width="80" height="80" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}
           <div><a href={product.url} target="_blank" rel="noopener noreferrer">{product.title} ↗</a><span>{price(product.price_huf)} · {health?.stale?'Utolsó ismert: ':''}{product.availability==='preorder' ? 'Előrendelhető' : product.availability==='in_stock' ? 'Raktáron' : ['mythgames','rtcollectorsclub'].includes(shop.id) ? 'Elérhető a listában' : 'Kosárba tehető'}{product.missing_count>0 ? ' · újbóli ellenőrzésre vár' : ''}</span></div>
      </article>)}</div>{!products.length && <p>{search.trim() ? 'Nincs a keresésnek megfelelő elérhető termék.' : 'Még nincs mentett elérhető termék.'}</p>}</details>
      <details className="pokemon-events"><summary>Legutóbbi változások · 24 óra ({events.length})</summary><p className="footnote">Csak az elmúlt 24 óra továbbra is elérhető termékei. A sikeres, teljes vizsgálatból hiányzó termék innen is eltűnik.</p>{!events.length && <p>{search.trim() ? 'Nincs a keresésnek megfelelő esemény.' : 'Az elmúlt 24 órából nincs továbbra is elérhető termékhez tartozó esemény.'}</p>}{events.map(event=><div className="pokemon-event" key={event.id}><div><strong>{eventLabels[event.kind] || event.kind}</strong><a href={event.url} target="_blank" rel="noopener noreferrer">{event.title} ↗</a></div><small>{date(event.occurred_at)}</small></div>)}</details>
      <p className="footnote">Eltűnés megerősítése: két teljes vizsgálat · termékenként 1 óra értesítési szünet · hibás vizsgálat nem írja felül az előző állapotot.</p>
    </div></LocalSection>;})}</LocalSections>
  </section>;
}
