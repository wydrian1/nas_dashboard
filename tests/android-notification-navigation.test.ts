import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('stock pushes use a direct immutable Activity pending intent and defer browser navigation until the Activity is resumed',()=>{
  const service=read('android/app/src/main/java/hu/wydrian/nas/NasMessagingService.java'),activity=read('android/app/src/main/java/hu/wydrian/nas/MainActivity.java');
  assert.match(service,/PendingIntent\.getActivity\(this, event\.hashCode\(\), NotificationNavigation\.destination\(this, data, event\), PendingIntent\.FLAG_UPDATE_CURRENT \| PendingIntent\.FLAG_IMMUTABLE\)/);
  assert.doesNotMatch(service,/resolveActivity|setSelector|CATEGORY_APP_BROWSER|startActivity/);
  assert.match(activity,/onCreate\(Bundle state\)[\s\S]*notificationNavigation\.receive\(getIntent\(\)\)/);
  assert.match(activity,/onResume\(\)[\s\S]*resumed=true;\s*openNotificationProduct\(\)/);
  assert.match(activity,/onNewIntent\(Intent intent\)[\s\S]*notificationNavigation\.receive\(intent\)[\s\S]*if \(resumed\) openNotificationProduct\(\)/);
  assert.match(activity,/if \(!notificationNavigation\.openProduct\(this\)\) toast/);
  const manifest=load(read('android/app/src/main/AndroidManifest.xml'),{xml:true});
  assert.equal(manifest('queries intent action').attr('android:name'),'android.intent.action.VIEW');
  assert.equal(manifest('queries intent data').attr('android:scheme'),'https');
  assert.equal(manifest('uses-permission[android\\:name="android.permission.QUERY_ALL_PACKAGES"]').length,0);
});
