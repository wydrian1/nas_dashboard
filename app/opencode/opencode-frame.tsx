'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
const origin='https://opencode.nas.wydrian.hu';
export default function OpenCodeFrame({enabled}:{enabled:boolean}) {
  const [ready,setReady]=useState(false),[error,setError]=useState<string>(),[generation,setGeneration]=useState(0),busy=useRef(false);
  const connect=useCallback(async()=>{
    if(!enabled || busy.current)return;busy.current=true;
    try{
      const response=await fetch('/api/opencode/connect',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok){setReady(false);throw new Error(response.status===401 ? 'A belépés lejárt. Jelentkezz be újra a dashboardba.' : response.status===403 ? 'Nincs OpenCode-hozzáférés.' : 'Az OpenCode-átjáró jelenleg nem érhető el.');}
      const data=await response.json();if(data.origin!==origin)throw new Error('Nem várt OpenCode-cím.');
      setReady(true);setError(undefined);
    }catch(error){setError(error instanceof Error ? error.message : 'A kapcsolat nem sikerült.');}finally{busy.current=false;}
  },[enabled]);
  useEffect(()=>{void connect();const timer=setInterval(()=>void connect(),120000);const visible=()=>{if(document.visibilityState==='visible')void connect();};document.addEventListener('visibilitychange',visible);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};},[connect]);
  if(!enabled)return <div className="opencode-notice"><strong>Az OpenCode-átjáró még nincs aktiválva.</strong><p>Az üzemeltetési beállítás és a HTTPS/DNS ellenőrzés után itt nyílik meg a teljes felület.</p></div>;
  return <section className="opencode-panel" aria-label="OpenCode munkaterület">
    <div className="opencode-toolbar"><span>{ready ? 'Tulajdonosi hozzáférés · titkosított kapcsolat' : 'Biztonságos kapcsolat előkészítése…'}</span><div><button className="secondary-button" type="button" onClick={()=>{void connect();setGeneration(value=>value+1);}}>↻ Újratöltés</button>{ready && <a className="secondary-button" href={origin} target="_blank" rel="noopener noreferrer">Külön megnyitás ↗</a>}</div></div>
    {error && <p className="opencode-error" role="alert">{error}</p>}
    {ready && <iframe key={generation} className="opencode-frame" src={origin} title="OpenCode privát fejlesztői felület" referrerPolicy="no-referrer" allow="clipboard-read; clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"/>}
  </section>;
}
