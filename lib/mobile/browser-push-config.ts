import {pushConfigured} from './push.ts';

export type FirebaseBrowserConfig={apiKey:string;authDomain?:string;projectId:string;storageBucket?:string;messagingSenderId:string;appId:string;vapidKey:string};
const publicValue=(value:string|undefined,max=512)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x20]/.test(value)?value:undefined;

export function firebaseBrowserConfig(env:Record<string,string|undefined>=process.env):FirebaseBrowserConfig|null {
  const apiKey=publicValue(env.NEXT_PUBLIC_FIREBASE_API_KEY),projectId=publicValue(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),messagingSenderId=publicValue(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),appId=publicValue(env.NEXT_PUBLIC_FIREBASE_APP_ID),vapidKey=publicValue(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,256);
  if(!apiKey||!projectId||!messagingSenderId||!appId||!vapidKey||! /^[A-Za-z0-9_-]{80,100}$/.test(vapidKey))return null;
  const authDomain=publicValue(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),storageBucket=publicValue(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  return {apiKey,projectId,messagingSenderId,appId,vapidKey,...(authDomain?{authDomain}:{}),...(storageBucket?{storageBucket}:{})};
}

export function browserPushConfigured(env:Record<string,string|undefined>=process.env):boolean{return pushConfigured(env)&&!!firebaseBrowserConfig(env);}
