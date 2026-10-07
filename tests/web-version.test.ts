import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEB_VERSION} from '../lib/mobile/release.ts';

test('web release label matches package and lock metadata; web-only release does not change native APK version',()=>{
  const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),manifest=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
  assert.equal(WEB_VERSION,'1.4.1');assert.equal(manifest.version,WEB_VERSION);assert.equal(lock.version,WEB_VERSION);assert.equal(lock.packages[''].version,WEB_VERSION);
  const native=read('android/app/build.gradle');assert.match(native,/versionName '1\.1\.0'/);assert.match(native,/versionCode 7\b/);
});
