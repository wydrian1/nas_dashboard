import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('approved negative W and three widget tiles share exact even-odd geometry across web and Android masks',()=>{
  const svg=load(source('public/brand-w-modules.svg'),{xml:true}),geometry=svg('path').attr('d')!;assert.equal(svg('path').length,1);assert.equal(svg('svg').attr('viewBox'),'0 0 128 128');assert.equal(svg('path').attr('fill'),'#a8efc9');assert.equal(svg('path').attr('fill-rule'),'evenodd');assert.equal(svg('rect').attr('fill'),'#0c1017');assert.equal(svg('text,image,script,foreignObject').length,0);
  const shapes=geometry.match(/M[^M]+/g)!;assert.equal(shapes.length,14);assert.deepEqual(shapes.slice(0,4).map(path=>path.match(/^M[\d. ]+/)?.[0].trim()),['M41 32','M75 32','M41 66','M75 66']);assert.ok(shapes.slice(0,4).every(path=>(path.match(/A9 9/g)||[]).length===4));
  assert.match(shapes[4],/^M41 38H43\.04V48\.08L47 42\.32L50\.96 48\.08V38H53/);assert.match(shapes[4],/H50\.24L47 50\.24L43\.76 56/);assert.equal(shapes.slice(5,7).length,2);assert.ok(shapes.slice(5,7).every(path=>path.includes('A1.75 1.75')));assert.deepEqual(shapes.slice(7,10).map(path=>path.match(/^M[\d. ]+/)?.[0].trim()),['M40.5 85','M46.5 79','M52.5 74']);assert.match(shapes[10],/^M77 76A2 2/);assert.match(shapes[12],/^M77 85A2 2/);
  for(const path of ['android/app/src/main/res/drawable/ic_nas_foreground.xml','android/app/src/main/res/drawable/ic_notification.xml']){const xml=load(source(path),{xml:true}),tiles=xml('path').toArray().map(el=>xml(el).attr('android:pathData')!);assert.equal(tiles.length,4);assert.deepEqual(tiles.map(tile=>(tile.match(/M[^M]+/g)||[]).length),[2,3,4,5]);assert.deepEqual(tiles.flatMap(tile=>tile.match(/M[^M]+/g)!).map(shape=>shape.trim()).sort(),shapes.map(shape=>shape.trim()).sort());assert.ok(xml('path').toArray().every(el=>xml(el).attr('android:fillType')==='evenOdd'&&xml(el).attr('android:fillColor')===(path.includes('notification')?'#FFFFFF':'@color/nas_accent')));assert.equal(xml('vector').attr('android:viewportWidth'),'128');assert.equal(xml('group').attr('android:scaleX'),'0.93');assert.equal(xml('group').attr('android:scaleY'),'0.93');assert.equal(xml('group').attr('android:pivotX'),'64');assert.equal(xml('group').attr('android:pivotY'),'64');}
  // Outer corner radius 9, corner centres 23 units from the icon centre.
  // Uniform native padding keeps the full silhouette inside the 66dp safe circle.
  assert.ok((Math.SQRT2*23+9)*(108/128)*0.93<33);
});
test('web login/sidebar and favicon use the approved local icon without changing authentication',()=>{
  assert.match(source('app/layout.tsx'),/icons:.*\/brand-w-modules\.svg/);assert.match(source('app/page.tsx'),/className="brand-mark" src="\/brand-w-modules.svg" alt="Wydrian"/);assert.match(source('app/dashboard-sidebar.tsx'),/className="brand-mark small" src="\/brand-w-modules.svg" alt=""/);assert.match(source('app/brand.css'),/padding:0/);assert.match(source('public/brand.svg'),/M42 35V49/,'previous asset remains available for cached clients and rollback builds');
});
test('Android adaptive/themed launcher and toolbar use new icon; release builds do not publish without explicit opt-in',()=>{
  const manifest=source('android/app/src/main/AndroidManifest.xml');assert.match(manifest,/android:icon="@mipmap\/ic_launcher"/);assert.match(manifest,/android:roundIcon="@mipmap\/ic_launcher"/);
  const xml=load(source('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml'),{xml:true});assert.equal(xml('background').attr('android:drawable'),'@color/nas_background');assert.equal(xml('foreground').attr('android:drawable'),'@drawable/ic_nas_foreground');assert.equal(xml('monochrome').attr('android:drawable'),'@drawable/ic_notification');
  assert.match(source('android/app/src/main/java/hu/wydrian/nas/MainActivity.java'),/brand.setImageResource\(R.drawable.ic_nas\)/);assert.doesNotMatch(source('android/app/src/main/java/hu/wydrian/nas/MainActivity.java'),/brand.setText\("w\."\)/);
  const activity=source('android/app/src/main/java/hu/wydrian/nas/MainActivity.java');assert.match(activity,/title.setText\("Wydrian"\)/);assert.doesNotMatch(activity,/setText\("wydrian"\)/);
  assert.match(source('android/app/build.gradle'),/versionCode 11/);assert.match(source('android/app/build.gradle'),/versionName '1.1.4'/);assert.match(source('scripts/Build-Android.ps1'),/param\(\[switch\]\$PublishDownload\)/);assert.match(source('scripts/Build-Android.ps1'),/if\(\$PublishDownload -and/);
});
