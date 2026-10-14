'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameView, VisibleSpot } from '@/lib/game/view';
import type { PlayerCommand } from '@/lib/game/types';
import { play, restart } from './actions';

const LABELS = { look: 'Megvizsgálom', take: 'Felveszem', talk: 'Beszélek', attack: 'Megtámadom' };
type Popup = { kind: 'scene' | 'item'; id: string; left: number; top: number; pinned: boolean };
export default function Game({ initialGame }: { initialGame: GameView }) {
  const [game,setGame]=useState(initialGame),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [source,setSource]=useState<string|null>(null),[mode,setMode]=useState<'use'|'combine'|null>(null),[target,setTarget]=useState<string|null>(null);
  const [popup,setPopup]=useState<Popup|null>(null),[zoom,setZoom]=useState(14),[resetOpen,setResetOpen]=useState(false);
  const lock=useRef(false),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),anchor=useRef<HTMLElement|null>(null),popupRef=useRef<HTMLElement|null>(null),dialog=useRef<HTMLDialogElement|null>(null);
  const restoringFocus=useRef(false);
  const item=game.inventory.find(entry=>entry.id===source);
  const targetLabel=game.scene.spots.find(entry=>entry.id===target)?.label;
  const spot=popup?.kind==='scene'?game.scene.spots.find(entry=>entry.id===popup.id):undefined;
  const inventory=popup?.kind==='item'?game.inventory.find(entry=>entry.id===popup.id):undefined;
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  useEffect(()=>{if(resetOpen)dialog.current?.showModal();else dialog.current?.close();},[resetOpen]);
  function clearSelection(){setSource(null);setMode(null);setTarget(null);setPopup(null);}
  function stopClose(){if(closeTimer.current)clearTimeout(closeTimer.current);closeTimer.current=null;}
  function hideLater(){stopClose();if(!popup?.pinned)closeTimer.current=setTimeout(()=>setPopup(null),180);}
  function show(kind:Popup['kind'],id:string,element:HTMLElement,pinned=false){
    if(restoringFocus.current)return;
    stopClose();anchor.current=element;const rect=element.getBoundingClientRect();
    setPopup({kind,id,pinned,left:Math.max(8,Math.min(rect.left,window.innerWidth-296)),top:rect.bottom+250<window.innerHeight?rect.bottom+8:Math.max(8,rect.top-250)});
  }
  function closePopup(){setPopup(null);restoringFocus.current=true;anchor.current?.focus();queueMicrotask(()=>{restoringFocus.current=false;});}
  function keyboard(event:React.KeyboardEvent<HTMLElement>){
    if(event.key==='ArrowDown'){event.preventDefault();requestAnimationFrame(()=>popupRef.current?.querySelector<HTMLButtonElement>('button')?.focus());}
    if(event.key==='Escape')closePopup();
  }
  async function send(command?:PlayerCommand){
    if(lock.current)return;lock.current=true;setBusy(true);setNotice('');setPopup(null);
    try{
      const result=command?await play(game.revision,command):await restart(game.revision,true);
      if(result.game){setGame(result.game);clearSelection();}
      if(!command&&result.game)setResetOpen(false);
      setNotice(result.error||(result.conflict?(command?'Másik böngészőfülben továbbhaladtál. A friss mentést betöltöttük; válassz újra.':'Az újrakezdés nem történt meg: másik böngészőfülben változott a mentés. Ellenőrizd a friss állapotot, majd erősítsd meg újra.') : ''));
    }catch{setNotice('A kapcsolat megszakadt. Újratöltéssel ellenőrizheted a szerveren elfogadott állapotot.');}
    finally{lock.current=false;setBusy(false);}
  }
  function clickSpot(entry:VisibleSpot,element:HTMLElement){
    if(mode==='use'&&item&&entry.environment){void send({verb:'use',item:item.id,target:{kind:'environment',id:entry.environment}});return;}
    if(mode==='combine'){setNotice('Kombináláshoz a másik tárgyra kattints az inventoryban.');return;}
    if(entry.exit){void send({verb:'move',target:{kind:'exit',id:entry.exit.id}});return;}
    setTarget(entry.id);show('scene',entry.id,element,true);
  }
  function clickItem(id:string,element:HTMLElement){
    if(mode==='combine'&&item){if(id===item.id){setNotice('Egy másik tárgyat válassz a kombináláshoz.');return;}void send({verb:'combine',item:item.id,target:{kind:'item',id}});return;}
    show('item',id,element,true);
  }
  function arm(id:string,action:'use'|'combine'){setSource(id);setMode(action);setTarget(null);setPopup(null);setNotice('');}
  const popupLabel=spot?.label??inventory?.label;
  return <div className="game-grid">
    <section className="scene panel" aria-label="Kattintható ASCII-jelenet">
      <div className="scene-heading"><h2>{game.scene.title}</h2><span role="status">{busy?'Mentés…':`Mentve · ${game.turns}. lépés`}</span></div>
      <div className="map-toolbar"><small>A rajzon válassz célpontot. A kijáratra kattintva mozogsz. Kisebb képernyőn a rajz oldalra görgethető.</small><div><button aria-label="ASCII kicsinyítése" disabled={zoom<=10} onClick={()=>setZoom(value=>value-1)}>−</button><button aria-label="ASCII nagyítása" disabled={zoom>=20} onClick={()=>setZoom(value=>value+1)}>+</button></div></div>
      <div className="ascii-scroll" onScroll={()=>{if(popup&&anchor.current)show(popup.kind,popup.id,anchor.current,popup.pinned);}}>
        <div className="ascii-canvas" role="group" aria-label={game.scene.description} style={{fontSize:zoom,width:`${game.scene.columns}ch`,height:`${game.scene.rows*1.45}em`}} onClick={event=>{if(event.target===event.currentTarget&&!busy&&!mode)void send({verb:'look'});}}>
          <pre aria-hidden="true">{game.scene.art}</pre>
          {game.scene.spots.map(entry=><button key={entry.id} className="ascii-hotspot" data-spot={entry.id} data-environment={entry.environment} data-exit={entry.exit?.id} aria-label={entry.label} aria-describedby={`spot-help-${entry.id}`} aria-pressed={target===entry.id} aria-haspopup="dialog" disabled={busy}
            style={{left:`${entry.col}ch`,top:`${entry.row*1.45}em`,width:`${entry.width}ch`,height:`${entry.height*1.45}em`}}
            onMouseEnter={event=>show('scene',entry.id,event.currentTarget)} onMouseLeave={hideLater} onFocus={event=>show('scene',entry.id,event.currentTarget)} onKeyDown={keyboard} onClick={event=>clickSpot(entry,event.currentTarget)}>
            {entry.glyph&&<span className="ascii-glyph" aria-hidden="true">{entry.glyph}</span>}
            <span className="sr-only" id={`spot-help-${entry.id}`}>{mode==='use'&&item&&entry.environment?`${item.label} használata itt.`:entry.exit?`Kattintás: mozgás — ${entry.exit.label}.`:'Kattintás: kijelölés. A lefelé nyíllal eléred a műveleteket.'}</span>
          </button>)}
        </div>
      </div>
      <div className="story" aria-live="polite" aria-atomic="true"><p>{game.message}</p></div>
      {notice&&<p className="notice" role="alert">{notice}</p>}
    </section>
    <section className="inventory panel" aria-label="Inventory"><h2>Inventory</h2><small>A tárgy műveletei a felugró címkén érhetők el.</small>
      {game.inventory.length?<div className="inventory-grid">{game.inventory.map(entry=><button className="inventory-item" key={entry.id} data-item={entry.id} aria-label={entry.label} aria-pressed={source===entry.id} aria-haspopup="dialog" disabled={busy}
        onMouseEnter={event=>show('item',entry.id,event.currentTarget)} onMouseLeave={hideLater} onFocus={event=>show('item',entry.id,event.currentTarget)} onKeyDown={keyboard} onClick={event=>clickItem(entry.id,event.currentTarget)}><pre aria-hidden="true">{entry.art}</pre></button>)}</div>:<p>A zsebeid üresek.</p>}
    </section>
    <section className="actions panel" aria-label="Akció"><h2>Akció</h2><p className="selection" role="status">{item&&mode?`${item.label} · ${mode==='use'?'használat: kattints a rajzon a célpontra':'kombinálás: kattints a másik inventorytárgyra'}`:targetLabel?`${targetLabel} kijelölve. Válassz műveletet a felugró címkén.`:'Körülnézés után a felfedezett részletek a rajzon is megjelennek.'}</p><div className="execute"><button disabled={busy} onClick={()=>void send({verb:'look'})}>Körülnézek</button><button className="quiet" disabled={busy} onClick={clearSelection}>Kijelölés törlése</button></div></section>
    <section className="notebook panel"><details><summary>Emléktöredékek <small>{game.journal.length}</small></summary><ol>{game.journal.map(entry=><li key={entry}>{entry}</li>)}</ol></details></section>
    <section className="book panel" aria-label="Történetkönyv"><details><summary>Történetkönyv <small>{game.book.length} emléklap</small></summary><div>{game.book.map((entry,index)=><article key={entry.id}><span className="eyebrow">{entry.chapter} · {index+1}. emléklap</span><h2>{entry.title}</h2><p>{entry.text}</p></article>)}</div></details></section>
    <section className="reset panel"><div><h2>Újrakezdés</h2><small>Csak a saját játékállásodat állítja alaphelyzetbe.</small></div><button className="quiet" disabled={busy} onClick={()=>{setPopup(null);setResetOpen(true);}}>Játék újrakezdése</button></section>
    <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-title" onCancel={event=>{if(busy)event.preventDefault();else setResetOpen(false);}} onClose={()=>setResetOpen(false)}>
      <h2 id="reset-title">Biztosan elölről kezded?</h2><p>A saját felszerelésed, haladásod, emléktöredékeid és történetkönyved visszaáll a nyitóállapotra. Más játékos mentése nem változik. Ez a művelet nem vonható vissza a játékból.</p><div className="execute"><button autoFocus disabled={busy} onClick={()=>setResetOpen(false)}>Mégsem</button><button className="danger" disabled={busy} onClick={()=>void send()}>Igen, elölről kezdem</button></div>{notice&&<p role="alert">{notice}</p>}
    </dialog>
    {popup&&popupLabel&&typeof document!=='undefined'&&createPortal(<aside ref={popupRef} className="context-popup" role="dialog" aria-label={popupLabel} style={{left:popup.left,top:popup.top}} onMouseEnter={stopClose} onMouseLeave={hideLater} onKeyDown={keyboard}>
      <div className="popup-heading"><strong>{popupLabel}</strong><button className="quiet" aria-label="Címke bezárása" onClick={closePopup}>×</button></div>
      {spot&&<><small>{mode==='use'&&item&&spot.environment?`Kattintás: ${item.label} használata itt.`:spot.exit?`Kattintás: mozgás — ${spot.exit.label}.`:'Kattintás: kijelölés. Válassz műveletet.'}</small><div className="popup-actions">
        {mode==='use'&&item&&spot.environment&&<button disabled={busy} onClick={()=>void send({verb:'use',item:item.id,target:{kind:'environment',id:spot.environment!}})}>Használom itt</button>}
        {spot.exit&&<button disabled={busy} onClick={()=>void send({verb:'move',target:{kind:'exit',id:spot.exit!.id}})}>Átmegyek</button>}
        {spot.environment&&spot.actions.map(verb=><button key={verb} disabled={busy} onClick={()=>void send({verb,target:{kind:'environment',id:spot.environment!}})}>{LABELS[verb]}</button>)}
        {spot.environment&&game.topics.filter(topic=>topic.target===spot.environment).map(topic=><button key={topic.id} disabled={busy} onClick={()=>void send({verb:'talk',target:{kind:'environment',id:spot.environment!},topic:topic.id})}>{topic.label}</button>)}
      </div></>}
      {inventory&&<div className="popup-actions"><button disabled={busy} onClick={()=>void send({verb:'look',target:{kind:'item',id:inventory.id}})}>Megvizsgálom</button><button disabled={busy} onClick={()=>arm(inventory.id,'use')}>Használom</button><button disabled={busy} onClick={()=>arm(inventory.id,'combine')}>Kombinálom</button></div>}
    </aside>,document.body)}
  </div>;
}
