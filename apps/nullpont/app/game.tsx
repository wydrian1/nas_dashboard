'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameView, VisibleSpot } from '@/lib/game/view';
import type { PlayerCommand } from '@/lib/game/types';
import { play, restart } from './actions';

const LABELS = { look: 'Megvizsgálom', take: 'Felveszem', talk: 'Beszélek', attack: 'Megtámadom', use: 'Működtetem' };
type IconName = keyof typeof LABELS | 'use' | 'combine' | 'move' | 'identity' | 'help' | 'cancel' | 'back';
const ICONS: Record<IconName,string> = {
  look:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  take:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  use:'m3 12 7-7 4 4-7 7-4-4Zm8 1 4 4m0-8 6-6m-3 0h3v3',
  combine:'M4 5h4l8 14h4M4 19h4L16 5h4m-3-3 3 3-3 3m0 8 3 3-3 3',
  talk:'M3 4h18v13H9l-6 4V4Z',
  attack:'m14 3 7 7-8 8-7-7 8-8Zm-7 9-4 9 9-4M3 3l3 3',
  move:'M3 12h17m-6-6 6 6-6 6',
  back:'M21 12H4m6-6-6 6 6 6',
  identity:'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',
  help:'M8 8a4 4 0 1 1 7 3l-3 2v3m0 4v1',
  cancel:'m6 6 12 12M6 18 18 6',
};
function ActionIcon({name}:{name:IconName}){return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]}/></svg>;}
type Popup = { kind: 'scene' | 'item'; id: string; left: number; top: number; pinned: boolean };
const useIsomorphicLayoutEffect=typeof window!=='undefined'?useLayoutEffect:useEffect;
export default function Game({ initialGame }: { initialGame: GameView }) {
  const [game,setGame]=useState(initialGame),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [source,setSource]=useState<string|null>(null),[mode,setMode]=useState<'use'|'combine'|null>(null),[target,setTarget]=useState<string|null>(null);
  const [popup,setPopup]=useState<Popup|null>(null),[zoom,setZoom]=useState(14),[resetOpen,setResetOpen]=useState(false);
  const lock=useRef(false),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),anchor=useRef<HTMLElement|null>(null),anchorRect=useRef<DOMRect|null>(null),popupRef=useRef<HTMLElement|null>(null),dialog=useRef<HTMLDialogElement|null>(null);
  const restoringFocus=useRef(false);
  const touch=useRef<{timer:ReturnType<typeof setTimeout>|null;x:number;y:number;opened:boolean}|null>(null);
  const item=game.inventory.find(entry=>entry.id===source);
  const spot=popup?.kind==='scene'?game.scene.spots.find(entry=>entry.id===popup.id):undefined;
  const inventory=popup?.kind==='item'?game.inventory.find(entry=>entry.id===popup.id):undefined;
  const input=spot?.environment?game.inputs.find(entry=>entry.id===spot.environment):undefined;
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);if(touch.current?.timer)clearTimeout(touch.current.timer);},[]);
  useEffect(()=>{if(resetOpen)dialog.current?.showModal();else dialog.current?.close();},[resetOpen]);
  // Correct the panel against its measured size before paint, so it always sits flush on the
  // side of its anchor with full room. A fixed height estimate left bottom-row items with a
  // ~130px gap, and the panel vanished before the pointer could reach its actions.
  useIsomorphicLayoutEffect(()=>{
    if(!popup)return;
    const rect=anchorRect.current,node=popupRef.current;
    if(!rect||!node)return;
    const margin=8,width=node.offsetWidth,height=node.offsetHeight;
    const below=rect.bottom+margin+height<=window.innerHeight;
    const top=Math.max(margin,Math.min(below?rect.bottom+margin:rect.top-margin-height,window.innerHeight-height-margin));
    const left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin));
    if(Math.abs(popup.left-left)>0.5||Math.abs(popup.top-top)>0.5)setPopup(current=>current?{...current,left,top}:current);
  },[popup]);
  // Keep an open panel attached to its anchor when the page scrolls or the window resizes
  // (the scene's own scroller is handled separately by the canvas onScroll handler).
  useEffect(()=>{
    if(!popup)return;
    const reposition=()=>{if(anchor.current)show(popup.kind,popup.id,anchor.current,popup.pinned);};
    window.addEventListener('scroll',reposition,{passive:true});
    window.addEventListener('resize',reposition);
    return ()=>{window.removeEventListener('scroll',reposition);window.removeEventListener('resize',reposition);};
  },[popup]);
  function clearSelection(){setSource(null);setMode(null);setTarget(null);setPopup(null);}
  function stopClose(){if(closeTimer.current)clearTimeout(closeTimer.current);closeTimer.current=null;}
  function hideLater(){stopClose();if(!popup?.pinned)closeTimer.current=setTimeout(()=>setPopup(null),180);}
  function show(kind:Popup['kind'],id:string,element:HTMLElement,pinned=false){
    if(restoringFocus.current)return;
    stopClose();anchor.current=element;
    const rect=element.getBoundingClientRect();anchorRect.current=rect;
    // First-paint estimate only; the layout effect above snaps it to the panel's real size.
    const estimate=132;
    setPopup({kind,id,pinned,left:Math.max(8,Math.min(rect.left,window.innerWidth-296)),top:rect.bottom+8+estimate<=window.innerHeight?rect.bottom+8:Math.max(8,rect.top-estimate-8)});
  }
  function closePopup(){setPopup(null);restoringFocus.current=true;anchor.current?.focus();queueMicrotask(()=>{restoringFocus.current=false;});}
  function keyboard(event:React.KeyboardEvent<HTMLElement>){
    if(event.key==='ArrowDown'){event.preventDefault();requestAnimationFrame(()=>popupRef.current?.querySelector<HTMLButtonElement>('button')?.focus());}
    if(event.key==='Escape')closePopup();
  }
  function stopTouch(){if(touch.current?.timer)clearTimeout(touch.current.timer);if(touch.current)touch.current.timer=null;}
  function startTouch(event:React.PointerEvent<HTMLElement>,entry:VisibleSpot){
    stopTouch();touch.current=null;
    if(event.pointerType!=='touch'||!event.isPrimary||busy)return;
    const element=event.currentTarget,press={timer:null as ReturnType<typeof setTimeout>|null,x:event.clientX,y:event.clientY,opened:false};
    touch.current=press;
    press.timer=setTimeout(()=>{press.timer=null;press.opened=true;setTarget(entry.id);show('scene',entry.id,element,true);},600);
  }
  async function send(command?:PlayerCommand,reopen?:{id:string;element:HTMLElement}){
    if(lock.current)return;lock.current=true;setBusy(true);setNotice('');setPopup(null);
    try{
      const result=command?await play(game.revision,command):await restart(game.revision,true);
      if(result.game){setGame(result.game);clearSelection();
        if(reopen&&!result.conflict&&!result.error&&result.game.scene.id===game.scene.id&&result.game.scene.spots.some(entry=>entry.id===reopen.id))show('scene',reopen.id,reopen.element,true);
      }
      if(!command&&result.game)setResetOpen(false);
      setNotice(result.error||(result.conflict?(command?'Másik böngészőfülben továbbhaladtál. A friss mentést betöltöttük; válassz újra.':'Az újrakezdés nem történt meg: másik böngészőfülben változott a mentés. Ellenőrizd a friss állapotot, majd erősítsd meg újra.') : ''));
    }catch{setNotice('A kapcsolat megszakadt. Újratöltéssel ellenőrizheted a szerveren elfogadott állapotot.');}
    finally{lock.current=false;setBusy(false);}
  }
  function clickSpot(entry:VisibleSpot,element:HTMLElement){
    if(mode==='use'&&item&&entry.environment){void send({verb:'use',item:item.id,target:{kind:'environment',id:entry.environment}});return;}
    if(mode==='combine'){setNotice('Kombináláshoz a másik tárgyra kattints a tárgyaid között.');return;}
    if(entry.exit){void send({verb:'move',target:{kind:'exit',id:entry.exit.id}});return;}
    if(entry.environment&&entry.actions.includes('look')){
      const hasInput=game.inputs.some(input=>input.id===entry.environment);
      void send({verb:'look',target:{kind:'environment',id:entry.environment}},hasInput?{id:entry.id,element}:undefined);return;
    }
    setTarget(entry.id);show('scene',entry.id,element,true);
  }
  function clickItem(id:string,element:HTMLElement){
    if(mode==='combine'&&item){if(id===item.id){setNotice('Egy másik tárgyat válassz a kombináláshoz.');return;}void send({verb:'combine',item:item.id,target:{kind:'item',id}});return;}
    show('item',id,element,true);
  }
  function arm(id:string,action:'use'|'combine'){setSource(id);setMode(action);setTarget(null);setPopup(null);setNotice('');}
  const popupLabel=spot?.label??inventory?.label;
  return <div className="game-grid" data-revision={game.revision} aria-busy={busy}>
    <section className="scene panel" aria-label="Kattintható ASCII-jelenet">
      <div className="scene-heading"><h2>{game.scene.title}</h2><div className="map-zoom"><button aria-label="ASCII kicsinyítése" title="Kicsinyítés" disabled={zoom<=10} onClick={()=>setZoom(value=>value-1)}>−</button><button aria-label="ASCII nagyítása" title="Nagyítás" disabled={zoom>=20} onClick={()=>setZoom(value=>value+1)}>+</button></div></div>
      <nav className="scene-path" aria-label="Helyzet"><button className="icon-action quiet" aria-label="Vissza egy szinttel" title="Vissza" disabled={busy||game.breadcrumbs.length<2} onClick={()=>void send({verb:'back'})}><ActionIcon name="back"/></button><ol>{game.breadcrumbs.map((entry,index)=><li key={entry.id}>{index>0&&<span aria-hidden="true">›</span>}{index===game.breadcrumbs.length-1?<span aria-current="location">{entry.title}</span>:<button disabled={busy} onClick={()=>void send({verb:'back',levels:game.breadcrumbs.length-1-index})}>{entry.title}</button>}</li>)}</ol></nav>
      <div className="ascii-scroll" onScroll={()=>{if(popup&&anchor.current)show(popup.kind,popup.id,anchor.current,popup.pinned);}}>
        <div className="ascii-canvas" role="group" aria-label={game.scene.description} style={{fontSize:zoom,width:`${game.scene.columns}ch`,height:`${game.scene.rows*1.45}em`}}>
          <pre aria-hidden="true">{game.scene.art}</pre>
          {game.scene.spots.map(entry=><div key={entry.id} className="ascii-spot" style={{left:`${entry.col}ch`,top:`${entry.row*1.45}em`,width:`${entry.width}ch`,height:`${entry.height*1.45}em`}}>
            <button className="ascii-hotspot" data-spot={entry.id} data-environment={entry.environment} data-exit={entry.exit?.id} aria-label={entry.label} aria-describedby={`spot-help-${entry.id}`} aria-pressed={target===entry.id} disabled={busy}
            onMouseEnter={event=>show('scene',entry.id,event.currentTarget)} onMouseLeave={hideLater} onFocus={event=>show('scene',entry.id,event.currentTarget)} onKeyDown={keyboard}
            onPointerDown={event=>startTouch(event,entry)} onPointerMove={event=>{if(touch.current&&Math.hypot(event.clientX-touch.current.x,event.clientY-touch.current.y)>10)stopTouch();}} onPointerUp={stopTouch} onPointerCancel={()=>{stopTouch();touch.current=null;}}
            onContextMenu={event=>{event.preventDefault();setTarget(entry.id);show('scene',entry.id,event.currentTarget,true);}} onClick={event=>{if(touch.current?.opened){touch.current=null;return;}clickSpot(entry,event.currentTarget);}}>
            {entry.glyph&&<span className="ascii-glyph" aria-hidden="true">{entry.glyph}</span>}
            <span className="sr-only" id={`spot-help-${entry.id}`}>{mode==='use'&&item&&entry.environment?`${item.label} használata itt.`:entry.exit?`Kattintás: mozgás — ${entry.exit.label}.`:'Kattintás: megvizsgálás. További műveletek: rámutatás, jobb kattintás, hosszú érintés vagy lefelé nyíl.'}</span>
            </button>
          </div>)}
        </div>
      </div>
      <div className="story" aria-live="polite" aria-atomic="true"><p>{game.message}</p></div>
      {notice&&<p className="notice" role="alert">{notice}</p>}
    </section>
    <section className="inventory panel" aria-label="Tárgyak"><h2>Tárgyak</h2>
      {item&&mode&&<div className="item-selection" role="status"><ActionIcon name={mode}/><span>{item.label}</span><button className="icon-action quiet" aria-label="Kijelölés törlése" title="Kijelölés törlése" disabled={busy} onClick={clearSelection}><ActionIcon name="cancel"/></button><span className="sr-only">{mode==='use'?'Használat':'Kombinálás'}</span></div>}
      {game.inventory.length?<div className="inventory-grid">{game.inventory.map(entry=><button className="inventory-item" key={entry.id} data-item={entry.id} aria-label={entry.label} aria-pressed={source===entry.id} aria-haspopup="dialog" disabled={busy}
        onMouseEnter={event=>show('item',entry.id,event.currentTarget)} onMouseLeave={hideLater} onFocus={event=>show('item',entry.id,event.currentTarget)} onKeyDown={keyboard} onClick={event=>clickItem(entry.id,event.currentTarget)}><pre aria-hidden="true">{entry.art}</pre></button>)}</div>:<p>A zsebeid üresek.</p>}
    </section>
    <section className="notebook panel"><details><summary>Emléktöredékek <small>{game.journal.length}</small></summary><ol>{game.journal.map(entry=><li key={entry}>{entry}</li>)}</ol></details></section>
    <section className="book panel" aria-label="Történetkönyv"><details><summary>Történetkönyv <small>{game.book.length} emléklap</small></summary><div>{game.book.map((entry,index)=><article key={entry.id}><span className="eyebrow">{entry.chapter} · {index+1}. emléklap</span><h2>{entry.title}</h2><p>{entry.text}</p></article>)}</div></details></section>
    <section className="reset panel"><div><h2>Újrakezdés</h2><small>Csak a saját játékállásodat állítja alaphelyzetbe.</small></div><button className="quiet" disabled={busy} onClick={()=>{setPopup(null);setResetOpen(true);}}>Játék újrakezdése</button></section>
    <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-title" onCancel={event=>{if(busy)event.preventDefault();else setResetOpen(false);}} onClose={()=>setResetOpen(false)}>
      <h2 id="reset-title">Biztosan elölről kezded?</h2><p>A saját felszerelésed, haladásod, emléktöredékeid és történetkönyved visszaáll a nyitóállapotra. Más játékos mentése nem változik. Ez a művelet nem vonható vissza a játékból.</p><div className="execute"><button autoFocus disabled={busy} onClick={()=>setResetOpen(false)}>Mégsem</button><button className="danger" disabled={busy} onClick={()=>void send()}>Igen, elölről kezdem</button></div>{notice&&<p role="alert">{notice}</p>}
    </dialog>
    {popup&&popupLabel&&typeof document!=='undefined'&&createPortal(<aside ref={popupRef} className="context-popup" role="dialog" aria-label={popupLabel} style={{left:popup.left,top:popup.top}} onMouseEnter={stopClose} onMouseLeave={hideLater} onKeyDown={keyboard}>
      <div className="popup-heading"><strong>{popupLabel}</strong><button className="icon-action quiet" aria-label="Címke bezárása" title="Bezárás" onClick={closePopup}><ActionIcon name="cancel"/></button></div>
      {spot&&<>{spot.exit&&<small className="exit-label">→ {spot.exit.label}</small>}<div className="popup-actions">
        {mode==='use'&&item&&spot.environment&&<button className="icon-action" aria-label="Használom itt" title={`${item.label} · használat`} disabled={busy} onClick={()=>void send({verb:'use',item:item.id,target:{kind:'environment',id:spot.environment!}})}><ActionIcon name="use"/></button>}
        {spot.exit&&<button className="icon-action" aria-label="Átmegyek" title={spot.exit.label} disabled={busy} onClick={()=>void send({verb:'move',target:{kind:'exit',id:spot.exit!.id}})}><ActionIcon name="move"/></button>}
        {spot.environment&&spot.actions.map(verb=><button className="icon-action" key={verb} aria-label={LABELS[verb]} title={LABELS[verb]} disabled={busy} onClick={()=>void send({verb,target:{kind:'environment',id:spot.environment!}})}><ActionIcon name={verb}/></button>)}
        {spot.environment&&game.topics.filter(topic=>topic.target===spot.environment).map(topic=><button className="icon-action" key={topic.id} aria-label={topic.label} title={topic.label} disabled={busy} onClick={()=>void send({verb:'talk',target:{kind:'environment',id:spot.environment!},topic:topic.id})}><ActionIcon name={topic.id==='identity'?'identity':topic.id==='help'?'help':'talk'}/></button>)}
      </div></>}
      {input&&<form key={input.id} className="scene-input" onSubmit={event=>{event.preventDefault();const value=new FormData(event.currentTarget).get('input');if(typeof value==='string')void send({verb:'submit',target:{kind:'environment',id:input.id},input:value});}} onFocus={()=>{stopClose();setPopup(current=>current?{...current,pinned:true}:current);}}><label htmlFor={`input-${input.id}`}>{input.label}</label><small id={`prompt-${input.id}`}>{input.prompt}</small><div><input id={`input-${input.id}`} name="input" type="text" inputMode={input.format==='digits'?'numeric':'text'} pattern={input.format==='digits'?'[0-9]+':undefined} maxLength={input.maxLength} aria-describedby={`prompt-${input.id}`} autoComplete="off" required disabled={busy}/><button className="icon-action" type="submit" aria-label="Bevitel elküldése" title="Elküldés" disabled={busy}><ActionIcon name="move"/></button></div></form>}
      {inventory&&<div className="popup-actions"><button className="icon-action" aria-label="Megvizsgálom" title="Megvizsgálom" disabled={busy} onClick={()=>void send({verb:'look',target:{kind:'item',id:inventory.id}})}><ActionIcon name="look"/></button><button className="icon-action" aria-label="Használom" title="Használom" disabled={busy} onClick={()=>arm(inventory.id,'use')}><ActionIcon name="use"/></button><button className="icon-action" aria-label="Kombinálom" title="Kombinálom" disabled={busy} onClick={()=>arm(inventory.id,'combine')}><ActionIcon name="combine"/></button></div>}
    </aside>,document.body)}
  </div>;
}
