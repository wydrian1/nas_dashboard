'use client';
import {useEffect,useRef,useState} from 'react';
import {getApp,getApps,initializeApp} from 'firebase/app';
import {deleteToken,getMessaging,getToken,isSupported,type Messaging} from 'firebase/messaging';
import type {FirebaseBrowserConfig} from '@/lib/mobile/browser-push-config';

async function messagingFor(config:FirebaseBrowserConfig):Promise<Messaging>{
  if(!await isSupported())throw new Error('Ez a böngésző nem támogatja a Firebase webes értesítéseit.');
  const {vapidKey,...options}=config,name='nas-browser-push';
  const app=getApps().some(item=>item.name===name)?getApp(name):initializeApp(options,name);
  return getMessaging(app);
}
async function requestJson(method:'GET'|'POST'|'DELETE',data?:Record<string,string>){
  const response=await fetch('/api/notifications/browser-push',{method,credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'A böngészős push beállítása nem sikerült.');return result;
}
export default function BrowserPushSettings({config}:{config:FirebaseBrowserConfig|null}){
  const [supported,setSupported]=useState(false),[subscribed,setSubscribed]=useState(false),[count,setCount]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('Ellenőrzés…'),token=useRef('');
  useEffect(()=>{
    let active=true;
    async function initialize(){
      try{
        const status=await requestJson('GET');if(!active)return;setCount(status.subscriptions||0);
        if(!config){setMessage('A szerver Firebase webes push-beállítása még nincs megadva.');return;}
        if(!('Notification'in window)||!('serviceWorker'in navigator)||!await isSupported()){setMessage('Ez a böngésző vagy eszköz nem támogatja a webes push értesítést.');return;}
        setSupported(true);
        if(Notification.permission==='denied'){setMessage('Az értesítéseket a böngésző letiltotta. Engedélyezd az oldal beállításaiban.');return;}
        if(Notification.permission==='granted'){
          const messaging=await messagingFor(config),registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'}),current=await getToken(messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
          if(!active)return;token.current=current;
          if(current&&status.subscriptions>0){await requestJson('POST',{token:current,label:'Böngésző'});if(active){setSubscribed(true);setMessage('A böngésző push értesítései engedélyezve vannak.');}}
          else setMessage('Ezen a böngészőn még nincs bekapcsolva a push.');
        }else setMessage('Engedélyezd a böngészős értesítéseket a feliratkozáshoz.');
      }catch(error){if(active)setMessage(error instanceof Error?error.message:'A böngésző push ellenőrzése nem sikerült.');}
    }
    void initialize();return()=>{active=false;};
  },[config]);
  async function toggle(){
    setBusy(true);setMessage('');
    try{
      if(!config)throw new Error('A böngészős push Firebase-beállítása hiányzik.');
      const messaging=await messagingFor(config),registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'});
      if(subscribed){
        const current=token.current||await getToken(messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
        if(current){await requestJson('DELETE',{token:current});await deleteToken(messaging);}
        token.current='';setSubscribed(false);setCount(value=>Math.max(0,value-1));setMessage('A böngésző push feliratkozása kikapcsolva.');
      }else{
        if(!('Notification'in window))throw new Error('Ez a böngésző nem támogatja az értesítéseket.');
        const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
        if(permission!=='granted')throw new Error(permission==='denied'?'Az értesítési engedélyt a böngésző megtagadta.':'Az értesítési engedélyezés megszakadt.');
        const current=await getToken(messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});if(!current)throw new Error('A böngésző nem adott Firebase értesítési azonosítót.');
        await requestJson('POST',{token:current,label:'Böngésző'});token.current=current;setSubscribed(true);setCount(value=>value+1);setMessage('Feliratkozva. Az új, beállításaidnak megfelelő push értesítések ide is megérkeznek.');
      }
    }catch(error){setMessage(error instanceof Error?error.message:'A művelet nem sikerült.');}
    finally{setBusy(false);}
  }
  return <section className="tools-panel browser-push-settings"><h2>Böngészős push értesítések</h2>
    <p>Feliratkozás: {count} böngésző · ugyanazok a saját webshop-, csendes időszak- és figyelőlista-beállítások érvényesek, mint a telefonos pushra.</p>
    <p className="footnote" role="status" aria-live="polite">{message}</p>
    <button type="button" className={subscribed?'secondary-button':'primary-button'} disabled={busy||(!supported&&!subscribed)||!config} onClick={()=>void toggle()}>{busy?'Feldolgozás…':subscribed?'Feliratkozás kikapcsolása':'Feliratkozás ezen a böngészőn'}</button>
    <p className="footnote">A böngésző értesítési engedélyét bármikor visszavonhatod az oldal beállításaiban; a már elküldött push kézbesítését ez nem vonja vissza.</p>
  </section>;
}
