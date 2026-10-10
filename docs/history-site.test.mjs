import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('./history-site/',import.meta.url));
const read=name=>readFileSync(resolve(root,name),'utf8');
const html=read('index.html'),js=read('presentation.js'),css=read('style.css');
const images=['mark','dashboard','architecture','pokemon','finance','mobile','collections','files','workflow'];

test('public story contains only reviewed static files, all local references exist, no data or remote URLs',()=>{
  const expected=['index.html','style.css','presentation.js',...images.map(name=>'assets/'+name+'.svg')].sort();
  const walk=path=>readdirSync(path).flatMap(name=>{
    const file=resolve(path,name);return statSync(file).isDirectory()?walk(file):[relative(root,file).split(sep).join('/')];
  });
  assert.deepEqual(walk(root).sort(),expected);
  for(const file of expected){
    const source=read(file);
    assert.doesNotMatch(source,/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i,file);
    assert.doesNotMatch(source,/\/api\/|\/s\/|\.env|\.sqlite|cashflow-row-|@gmail|BEGIN .*PRIVATE KEY|__Secure-authjs|AIza|S-1-5-21-/i,file);
    assert.doesNotMatch(source,/<(?:iframe|form|object|embed)\b|<script\b[^>]*>(?!\s*<\/script>)/i,file);
  }
  for(const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)){
    assert.doesNotMatch(match[1],/^(?:\/|\w+:)/);assert.ok(expected.includes(match[1]),match[1]);
  }
  assert.match(html,/connect-src 'none'/);assert.match(html,/<html lang="hu">/);
  assert.match(html,/szintetikus illusztráció/);assert.match(html,/nem éles képernyőkép/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie/);
});

test('14 chapters have headings, notes, unique anchors and matching chapter navigation',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(let i=1;i<=14;i++){
    const number=String(i).padStart(2,'0');assert.ok(ids.includes('chapter-'+number));assert.ok(ids.includes('title-'+number));
    assert.match(html,new RegExp('href="#chapter-'+number+'"'));
  }
  assert.equal((html.match(/class="speaker-notes"/g)||[]).length,14);
  for(const image of images.filter(name=>name!=='mark')){
    const svg=read('assets/'+image+'.svg');assert.match(svg,/<title\b/);assert.match(svg,/<desc\b/);
    assert.doesNotMatch(svg,/<script|<foreignObject|\b(?:href|onload|onclick)=/);
    assert.match(html,new RegExp('src="assets/'+image+'\\.svg"[^>]+alt="[^"]+"'));
  }
  assert.match(html,/2026\. október 10-ig/);
});

test('story covers evidenced pre-GitHub milestones, major later features and anonymized sample prompts',()=>{
  const chapter=number=>html.match(new RegExp('<section id="chapter-'+number+'"[\\s\\S]*?<\\/section>'))?.[0]??'';
  for(const number of ['02','03','04','05','06'])assert.match(chapter(number),/GITHUB ELŐTT/);
  assert.match(chapter('02'),/2026\. SZEPTEMBER 30\./);assert.match(chapter('02'),/RSS-hírolvasó/);
  assert.match(chapter('03'),/12 → 15/);assert.match(chapter('03'),/Bloomrift/);
  assert.match(chapter('04'),/Új boltok új APK nélkül/);
  assert.match(chapter('05'),/Excelből/);assert.match(chapter('06'),/Google Drive-mentés/);
  assert.match(chapter('06'),/01:03/);assert.match(chapter('06'),/01:19/);
  assert.match(chapter('08'),/Pokémon-reader/);assert.match(chapter('08'),/Határidő-emlékeztetők/);
  assert.match(chapter('09'),/Mentett és aktuális/);assert.match(chapter('10'),/feltöltési haladás és megszakítás/);
  assert.match(chapter('11'),/rendezőnyilak alapból rejtettek/i);
  assert.equal((chapter('12').match(/<blockquote>/g)||[]).length,2);
  assert.match(chapter('12'),/Nem szó szerinti idézetek/);assert.match(chapter('12'),/Google-belépéssel/);
  assert.match(chapter('12'),/Firebase-projektet/);
  assert.doesNotMatch(chapter('12'),/https?:|[A-Z]:\\|@|ses_|msg_/i);
  assert.match(chapter('13'),/datetime="2026-09-30"/);assert.match(chapter('13'),/datetime="2026-10-09"/);
  const mainStory=html.replace(/<aside class="speaker-notes">[\s\S]*?<\/aside>/g,'');
  assert.doesNotMatch(mainStory,/class="commit"|PR \d|287|141|323 teszt|Web 1\.4\.1/);
  assert.match(chapter('14'),/Web 1\.4\.6 · Android 1\.1\.4/);
  assert.match(chapter('14'),/valódi telefonos értesítésnyitás/);
  assert.match(read('assets/pokemon.svg'),/15 bekötött webshop/);
});

test('print shows all slides; no-JS, narrow layout and reduced-motion are supported',()=>{
  assert.match(html,/<noscript>/);assert.match(css,/\[hidden\]\{display:none!important\}/);
  assert.match(css,/@media print/);assert.match(css,/\.deck>\.slide\[hidden\]\{display:block!important/);
  assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.timeline\.milestone-timeline p\{font-size:10px;line-height:1\.4\}/);
  assert.match(css,/#chapter-13 \.slide-footer\{margin-top:10px\}/);
});

test('public route uses only the closed story file list and does not alter private application routes',()=>{
  const rootRoute=readFileSync(new URL('../app/timeline/route.ts',import.meta.url),'utf8');
  const assets=readFileSync(new URL('../app/timeline/[...asset]/route.ts',import.meta.url),'utf8');
  const adapter=readFileSync(new URL('../lib/timeline-site.ts',import.meta.url),'utf8');
  assert.match(rootRoute,/dynamic='force-static'/);assert.match(assets,/dynamicParams=false/);assert.match(assets,/generateStaticParams/);
  assert.match(adapter,/timelineAssets\.includes\(file\)/);assert.match(adapter,/docs\/history-site/);
  assert.doesNotMatch(rootRoute+assets+adapter,/requireUser|requireAdmin|\.env|db\(|fetch\(/);
});

function harness(hash=''){
  const handlers=new Map();
  const make=(id,text='')=>({id,hidden:false,disabled:false,textContent:text,style:{},classList:{toggle(){},add(){}},
    listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(key,value){this[key]=value;},focus(){this.focused=true;},closest(){return null;}});
  const slides=Array.from({length:14},(_,i)=>{const s=make('chapter-'+String(i+1).padStart(2,'0'));s.heading=make('heading','Dia '+(i+1));s.querySelector=()=>s.heading;return s;});
  const ids=Object.fromEntries(['previous','next','position','progress','timeline-dialog','notes-toggle','fullscreen','timeline-open','timeline-close'].map(id=>[id,make(id)]));
  ids['timeline-dialog'].showModal=function(){this.open=true;};ids['timeline-dialog'].close=function(){this.open=false;};
  const deck=make('deck');deck.querySelectorAll=()=>slides;
  const links=slides.map(slide=>{const link=make('link');link.getAttribute=()=>'#'+slide.id;return link;});
  const controls=make('controls');let noteState=false;
  const document={title:'',body:{classList:{toggle(){return noteState=!noteState;}}},
    documentElement:{async requestFullscreen(){document.fullscreenElement={};}},async exitFullscreen(){document.fullscreenElement=null;},
    getElementById:id=>ids[id],querySelector:selector=>selector==='.deck'?deck:controls,
    querySelectorAll:selector=>selector.includes('header-actions')?[ids.fullscreen,ids['notes-toggle'],ids['timeline-open']]:links,
    addEventListener(type,fn){handlers.set('document:'+type,fn);}};
  const window={location:{hash},scrollTo(){},addEventListener(type,fn){handlers.set('window:'+type,fn);}};
  const history={replaceState(_a,_b,value){window.location.hash=value;}};
  vm.runInNewContext(js,{document,window,history});
  const key=name=>handlers.get('document:keydown')({key:name,target:make('target'),preventDefault(){}});
  return {slides,ids,deck,links,controls,document,window,key,handlers};
}

test('navigation: buttons, keyboard, boundaries, hash, chapter dialog, notes and swipe',async()=>{
  const h=harness();const active=()=>h.slides.findIndex(s=>!s.hidden);
  assert.equal(active(),0);assert.equal(h.ids.previous.disabled,true);assert.equal(h.ids.position.textContent,'01 / 14');
  h.ids.next.listeners.click();assert.equal(active(),1);assert.equal(h.window.location.hash,'#chapter-02');
  h.key('ArrowRight');assert.equal(active(),2);h.key('PageUp');assert.equal(active(),1);
  h.key('End');assert.equal(active(),13);assert.equal(h.ids.next.disabled,true);h.key('ArrowRight');assert.equal(active(),13);
  h.key('Home');assert.equal(active(),0);h.key('ArrowLeft');assert.equal(active(),0);
  h.key('n');assert.equal(h.ids['notes-toggle']['aria-pressed'],'true');h.key('n');assert.equal(h.ids['notes-toggle']['aria-pressed'],'false');
  h.ids['timeline-open'].listeners.click();assert.equal(h.ids['timeline-dialog'].open,true);
  h.key('ArrowRight');assert.equal(active(),0);
  h.links[3].listeners.click({preventDefault(){}});assert.equal(active(),3);assert.equal(h.ids['timeline-dialog'].open,false);
  h.window.location.hash='#chapter-08';h.handlers.get('window:hashchange')();assert.equal(active(),7);
  const target={closest(){return null;}};h.deck.listeners.pointerdown({pointerType:'touch',target,clientX:200,clientY:100});
  h.deck.listeners.pointerup({clientX:80,clientY:105});assert.equal(active(),8);
  h.deck.listeners.pointerdown({pointerType:'touch',target,clientX:200,clientY:100});h.deck.listeners.pointercancel();
  h.deck.listeners.pointerup({clientX:80,clientY:105});assert.equal(active(),8);
  h.ids.fullscreen.listeners.click();await Promise.resolve();assert.ok(h.document.fullscreenElement);
  assert.equal(harness('#chapter-09').slides[8].hidden,false);assert.equal(harness('#unknown').slides[0].hidden,false);
});
