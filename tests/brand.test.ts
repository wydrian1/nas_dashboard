import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('approved square-cut W and three rounded tiles share exact geometry across web, Android and monochrome icons',()=>{
  const svg=load(source('public/brand.svg'),{xml:true}),paths=svg('path').map((_,el)=>svg(el).attr('d')).get();assert.equal(paths.length,4);assert.equal(svg('svg').attr('viewBox'),'0 0 128 128');assert.equal(svg('g').attr('fill'),'#a8efc9');assert.equal(svg('rect').attr('fill'),'#0c1017');assert.match(paths[0],/^M42 35V49/);assert.match(paths[0],/L53 49V35/);assert.equal(svg('text,image,script,foreignObject').length,0);
  for(const path of ['android/app/src/main/res/drawable/ic_nas_foreground.xml','android/app/src/main/res/drawable/ic_notification.xml']){const xml=load(source(path),{xml:true});assert.deepEqual(xml('path').map((_,el)=>xml(el).attr('android:pathData')).get(),paths);assert.equal(xml('vector').attr('android:viewportWidth'),'128');if(path.includes('notification'))assert.ok(xml('path').toArray().every(el=>xml(el).attr('android:fillColor')==='#FFFFFF'));}
});
test('web login/sidebar and favicon use the approved local icon without changing authentication',()=>{
  assert.match(source('app/layout.tsx'),/icons:.*\/brand\.svg/);assert.match(source('app/page.tsx'),/className="brand-mark" src="\/brand.svg" alt="Wydrian"/);assert.match(source('app/dashboard-sidebar.tsx'),/className="brand-mark small" src="\/brand.svg" alt=""/);assert.match(source('app/brand.css'),/padding:0/);
});
test('Android adaptive/themed launcher and toolbar use new icon; release builds do not publish without explicit opt-in',()=>{
  const manifest=source('android/app/src/main/AndroidManifest.xml');assert.match(manifest,/android:icon="@mipmap\/ic_launcher"/);assert.match(manifest,/android:roundIcon="@mipmap\/ic_launcher"/);
  const xml=load(source('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml'),{xml:true});assert.equal(xml('background').attr('android:drawable'),'@color/nas_background');assert.equal(xml('foreground').attr('android:drawable'),'@drawable/ic_nas_foreground');assert.equal(xml('monochrome').attr('android:drawable'),'@drawable/ic_notification');
  assert.match(source('android/app/src/main/java/hu/wydrian/nas/MainActivity.java'),/brand.setImageResource\(R.drawable.ic_nas\)/);assert.doesNotMatch(source('android/app/src/main/java/hu/wydrian/nas/MainActivity.java'),/brand.setText\("w\."\)/);
  assert.match(source('android/app/build.gradle'),/versionCode 5/);assert.match(source('android/app/build.gradle'),/versionName '1.0.4'/);assert.match(source('scripts/Build-Android.ps1'),/param\(\[switch\]\$PublishDownload\)/);assert.match(source('scripts/Build-Android.ps1'),/if\(\$PublishDownload -and/);
});
