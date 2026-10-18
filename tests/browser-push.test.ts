import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {firebaseBrowserConfig} from '../lib/mobile/browser-push-config.ts';
const vapid='B'.repeat(87);
const configured={NEXT_PUBLIC_FIREBASE_API_KEY:'public-api-key',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'nas-wydrian-hu',NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:'123456789',NEXT_PUBLIC_FIREBASE_APP_ID:'1:123456789:web:abcdef',NEXT_PUBLIC_FIREBASE_VAPID_KEY:vapid};

test('Browser push config accepts only complete public Firebase app data and a valid VAPID public key',()=>{
  assert.deepEqual(firebaseBrowserConfig(configured),{apiKey:'public-api-key',projectId:'nas-wydrian-hu',messagingSenderId:'123456789',appId:'1:123456789:web:abcdef',vapidKey:vapid});
  assert.equal(firebaseBrowserConfig({...configured,NEXT_PUBLIC_FIREBASE_API_KEY:'bad\nheader'}),null);
  assert.equal(firebaseBrowserConfig({...configured,NEXT_PUBLIC_FIREBASE_VAPID_KEY:'private-or-malformed'}),null);
  assert.equal(firebaseBrowserConfig(Object.fromEntries(Object.entries(configured).filter(([key])=>key!=='NEXT_PUBLIC_FIREBASE_APP_ID'))),null);
});

test('Browser push uses an app-owned root service worker and same-origin notification targets',()=>{
  const worker=readFileSync(new URL('../public/firebase-messaging-sw.js',import.meta.url),'utf8');
  assert.match(worker,/addEventListener\('push'/);assert.match(worker,/showNotification/);assert.match(worker,/addEventListener\('notificationclick'/);assert.match(worker,/target\.origin!==self\.location\.origin/);assert.match(worker,/self\.clients\.openWindow/);
  const component=readFileSync(new URL('../app/notifications/browser-push.tsx',import.meta.url),'utf8');
  assert.match(component,/Notification\.requestPermission/);assert.match(component,/getToken\(/);assert.match(component,/deleteToken\(/);assert.match(component,/firebase-messaging-sw\.js/);assert.match(component,/credentials:'same-origin'/);
});

test('Browser subscription API checks authenticated role and exact dashboard same-origin before mutations',()=>{
  const route=readFileSync(new URL('../app/api/notifications/browser-push/route.ts',import.meta.url),'utf8');
  assert.match(route,/requireUser\(\)/);assert.match(route,/dashboardSameOrigin\(request\)/);assert.match(route,/device_type='browser'/);assert.match(route,/Cache-Control':'private, no-store'/);assert.match(route,/registerBrowserPush/);assert.match(route,/removeBrowserPush/);
  assert.doesNotMatch(route,/return Response\.json\(\{[^\n]*(?:token|secret_hash)/);
});
