"use client";
import {useState,useRef,useEffect} from 'react';
import type {HostingListing,HostedLink,HostedEntry} from '@/lib/file-hosting/types';
import {MAX_FILE_BYTES,formatFileSize} from '@/lib/file-hosting/types';
import LocalSections,{LocalSection} from '../local-sections';

type Link=HostedLink&{url:string|null};
type Listing=Omit<HostingListing,'links'>&{links:Link[]};
async function responseJson(response:Response) {const data=await response.json();if(!response.ok)throw new Error(data.error||'A művelet nem sikerült.');return data;}
export default function FileManager({initial}:{initial:Listing}) {
  const [data,setData]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[progress,setProgress]=useState<number|null>(null),[origin,setOrigin]=useState('');
  const [folderName,setFolderName]=useState(''),[selected,setSelected]=useState<HostedEntry|null>(null),[expiry,setExpiry]=useState('24'),[customDate,setCustomDate]=useState('');
  const xhr=useRef<XMLHttpRequest|null>(null),fileInput=useRef<HTMLInputElement|null>(null),parent=data.folder?.id??null;
  useEffect(()=>()=>xhr.current?.abort(),[]);
  useEffect(()=>setOrigin(window.location.origin),[]);
  const refresh=async()=>setData(await responseJson(await fetch('/api/files'+(parent?'?folder='+parent:''),{cache:'no-store'})));
  async function operation(action:()=>Promise<void>) {setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:'A művelet nem sikerült.');}finally{setBusy(false);setProgress(null);}}
  async function makeFolder(event:React.FormEvent) {event.preventDefault();await operation(async()=>{await responseJson(await fetch('/api/files/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parent,name:folderName})}));setFolderName('');await refresh();setMessage('Mappa létrehozva.');});}
  async function upload(event:React.FormEvent) {event.preventDefault();const files=Array.from(fileInput.current?.files||[]);await operation(async()=>{
    if(!files.length)throw new Error('Válassz fájlt.');if(files.some(file=>file.size>MAX_FILE_BYTES))throw new Error('Egy fájl legfeljebb 1 GB lehet.');
    let completed=0;
    try{for(const file of files){setMessage(`Feltöltés: ${file.name} (${completed+1}/${files.length})`);setProgress(0);
      await new Promise<void>((resolve,reject)=>{const request=new XMLHttpRequest();xhr.current=request;const params=new URLSearchParams({name:file.name});if(parent)params.set('folder',parent);request.open('POST','/api/files/upload?'+params);request.setRequestHeader('Content-Type','application/octet-stream');request.timeout=60*60*1000;
        request.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.min(100,Math.round(e.loaded/e.total*100)));};
        request.onload=()=>{xhr.current=null;try{const body=JSON.parse(request.responseText);if(request.status>=200&&request.status<300)resolve();else reject(new Error(body.error||'Feltöltési hiba.'));}catch{reject(new Error('A feltöltés válasza nem értelmezhető.'));}};
        request.onerror=()=>{xhr.current=null;reject(new Error('Hálózati hiba; a félkész feltöltés nem osztható meg.'));};request.onabort=()=>{xhr.current=null;reject(new Error('Feltöltés megszakítva.'));};request.ontimeout=()=>{xhr.current=null;reject(new Error('A feltöltés túllépte az egyórás időkorlátot.'));};request.send(file);
      });completed++;}
      if(fileInput.current)fileInput.current.value='';setMessage(`${completed} fájl feltöltve.`);
    }finally{await refresh();}
  });}
  async function share(event:React.FormEvent) {event.preventDefault();if(!selected)return;await operation(async()=>{
    const expiresAt=expiry==='permanent'?null:expiry==='custom'?new Date(customDate).getTime():Date.now()+Number(expiry)*3600000;
    if(expiresAt!==null&&(!Number.isFinite(expiresAt)||expiresAt<=Date.now()))throw new Error('Válassz jövőbeli lejáratot.');
    await responseJson(await fetch('/api/files/links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:selected.id,expiresAt})}));await refresh();setMessage('Megosztási link létrehozva; lent másolható.');setSelected(null);
  });}
  async function revoke(link:Link) {if(!window.confirm('Visszavonod ezt a megosztási linket? Új letöltések többé nem indulhatnak vele.'))return;await operation(async()=>{await responseJson(await fetch('/api/files/links',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:link.id})}));await refresh();setMessage('Megosztás visszavonva.');});}
  async function removeFile(entry:HostedEntry){if(!window.confirm(`Törlöd ezt a fájlt: ${entry.name}? Az összes hozzá tartozó megosztási link is törlődik. Nem vonható vissza.`))return;await operation(async()=>{try{await responseJson(await fetch('/api/files/'+entry.id,{method:'DELETE'}));if(selected?.id===entry.id)setSelected(null);setMessage('Fájl és megosztási linkjei törölve.');}finally{await refresh();}});}
  async function copy(value:string) {try{await navigator.clipboard.writeText(new URL(value,window.location.origin).href);setMessage('Link a vágólapon.');setError('');}catch{setError('A vágólap nem érhető el; jelöld ki és másold a linket a mezőből.');}}
  const active=(link:Link)=>link.revoked_at===null&&(link.expires_at===null||link.expires_at>Date.now());
  return <LocalSections page="files"><LocalSection sectionId="upload" label="Feltöltés">
    <section className="files-panel"><nav className="files-breadcrumbs" aria-label="Fájlmappa"><a href="/files" onClick={e=>{if(busy)e.preventDefault();}}>Tároló</a>{data.breadcrumbs.map(folder=><span key={folder.id}> / <a href={'/files?folder='+folder.id} onClick={e=>{if(busy)e.preventDefault();}}>{folder.name}</a></span>)}</nav>
      <p className="files-note">Dedikált NAS-tároló; a meglévő szerverfájlok nem kerülnek ide automatikusan. Az azonos nevű fájlt nem írjuk felül. A megosztási linket bárki használhatja, aki megkapja — kezeld bizalmasan.</p>
      <div className="files-tools"><form onSubmit={makeFolder}><label>Új mappa<input value={folderName} onChange={e=>setFolderName(e.target.value)} maxLength={180} required disabled={busy}/></label><button disabled={busy}>Mappa létrehozása</button></form>
      <form onSubmit={upload}><label>Fájlok feltöltése<input type="file" multiple ref={fileInput} required disabled={busy}/></label><button disabled={busy}>Feltöltés</button></form></div>
      {progress!==null&&<div className="files-progress"><progress value={progress} max={100} aria-label="Feltöltési állapot"/><span>{progress}%{progress===100?' · szerveroldali mentés…':''}</span><button type="button" onClick={()=>xhr.current?.abort()}>Megszakítás</button></div>}
      <div aria-live="polite">{message&&<p className="files-success">{message}</p>}{error&&<p className="files-error" role="alert">{error}</p>}</div>
    </section></LocalSection>
    <LocalSection sectionId="entries" label="Fájlok"><section className="files-panel"><h2>{data.folder?.name||'Tároló'} · {data.entries.length} bejegyzés</h2><div className="files-table-wrap"><table className="files-table"><thead><tr><th>Név</th><th>Méret</th><th>Állapot</th><th>Kezelés</th></tr></thead><tbody>{data.entries.map(entry=><tr key={entry.id}><th>{entry.kind==='folder'?<a href={'/files?folder='+entry.id} onClick={e=>{if(busy||entry.state!=='ready')e.preventDefault();}}>▱ {entry.name}</a>:entry.name}</th><td>{entry.kind==='file'?formatFileSize(entry.size):'Mappa'}</td><td>{entry.state==='ready'?'Kész':'Folyamatban / félkész'}</td><td>{entry.kind==='file'&&entry.state==='ready'&&<div className="files-row-actions"><a href={'/api/files/'+entry.id+'/download'}>Letöltés</a><button disabled={busy} onClick={()=>{setSelected(entry);setError('');}}>Link létrehozása</button><button disabled={busy} onClick={()=>removeFile(entry)}>Törlés</button></div>}</td></tr>)}</tbody></table></div>{!data.entries.length&&<p>Ez a mappa még üres.</p>}</section></LocalSection>
    {selected&&<LocalSection sectionId="share" label="Link létrehozása"><section className="files-panel" aria-labelledby="share-title"><h2 id="share-title">Megosztás: {selected.name}</h2><form className="files-share-form" onSubmit={share}><label>Lejárat<select value={expiry} onChange={e=>setExpiry(e.target.value)} disabled={busy}><option value="1">1 óra</option><option value="24">24 óra</option><option value="168">7 nap</option><option value="720">30 nap</option><option value="custom">Egyedi időpont</option><option value="permanent">Állandó (visszavonásig)</option></select></label>{expiry==='custom'&&<label>Lejárat időpontja<input type="datetime-local" value={customDate} onChange={e=>setCustomDate(e.target.value)} required disabled={busy}/></label>}<button disabled={busy}>Megosztási link létrehozása</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Mégse</button></form><p className="files-note">A link kizárólag ezt a fájlt tölti le, bejelentkezés nélkül. Mappalistát és adminműveleteket nem enged. A visszavonás az új letöltéseket állítja meg, a már letöltött másolatot nem törli.</p></section></LocalSection>}
    <LocalSection sectionId="links" label="Megosztások"><section className="files-panel"><h2>Megosztások ebben a mappában</h2>{!data.links.length&&<p>Még nincs megosztási link.</p>}<div className="files-links">{data.links.map(link=><article className="files-link" key={link.id}><strong>{data.entries.find(entry=>entry.id===link.file_id)?.name||'Fájl'}</strong><span>{link.revoked_at!==null?'Visszavonva':link.expires_at===null?'Állandó':new Date(link.expires_at).toLocaleString('hu-HU')+(active(link)?' · lejárat':' · lejárt')}</span>{active(link)&&link.url&&<><input aria-label="Megosztási link" readOnly value={link.url.startsWith('/')?origin+link.url:link.url} onFocus={e=>e.target.select()}/><button disabled={busy} onClick={()=>copy(link.url!)}>Másolás</button></>}{link.revoked_at===null&&<button disabled={busy} onClick={()=>revoke(link)}>Visszavonás</button>}</article>)}</div></section></LocalSection>
  </LocalSections>;
}
