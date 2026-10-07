"use client";
import {useState} from 'react';
import type {OpenCodePreview} from '@/lib/opencode-preview';
type Preview=Omit<OpenCodePreview,'sha256'>;
export default function OpenCodePreviews(){
  const [items,setItems]=useState<Preview[]>([]),[selected,setSelected]=useState<Preview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[text,setText]=useState('');
  async function refresh(){setBusy(true);setError('');try{const response=await fetch('/api/opencode/previews',{cache:'no-store'});if(!response.ok)throw new Error('Az előnézetek nem érhetők el.');setItems((await response.json()).previews);}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
  async function select(item:Preview){setBusy(true);setError('');setSelected(null);setText('');try{if(item.type==='text/plain'){const response=await fetch('/api/opencode/previews/'+item.id,{cache:'no-store'});if(!response.ok)throw new Error('Az előnézet nem érhető el.');setText(await response.text());}setSelected(item);}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
  return <section className="opencode-previews"><div className="section-heading"><h2>Előnézetek</h2><button type="button" disabled={busy} onClick={refresh}>Frissítés</button></div><p className="footnote">Külön közzétett fájlok, képek és önálló HTML-ek. Nem az OpenCode élő desktopböngészője. Csak a tulajdonos látja.</p>
    <div className="preview-list">{items.map(item=><button type="button" key={item.id} disabled={busy} onClick={()=>select(item)}>{item.title}</button>)}</div>{!items.length&&<p>Még nincs betöltött előnézet. A Frissítés tölti be a közzétett fájlokat.</p>}{error&&<p role="alert" className="error">{error}</p>}
    {selected&&<div className="preview-content"><h3>{selected.title}</h3>{selected.type==='text/plain'?<pre>{text}</pre>:selected.type.startsWith('image/')?<img src={'/api/opencode/previews/'+selected.id} alt={selected.title}/>:<iframe title={selected.title} src={'/api/opencode/previews/'+selected.id} sandbox="" referrerPolicy="no-referrer"/>}</div>}
  </section>;
}
