import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import ts from 'typescript';
const require=createRequire(import.meta.url),source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function component(path:string,hooks?:unknown,environment:Record<string,unknown>={}):any {
  const output=ts.transpileModule(source(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports:Record<string,any>={};
  new Function('require','exports','XMLHttpRequest','fetch',output)((name:string)=>{
    if(name==='react')return hooks??require(name);
    if(name==='@/lib/file-hosting/types')return require('../lib/file-hosting/types.ts');
    if(name==='@/lib/section-order')return require('../lib/section-order.ts');
    if(name==='@/lib/section-controls')return require('../lib/section-controls.ts');
    if(name==='../local-sections')return component('app/local-sections.tsx');
    return require(name);
  },exports,environment.XMLHttpRequest,environment.fetch??globalThis.fetch);return exports;
}
const empty=()=>({folder:null,breadcrumbs:[],entries:[],links:[],maxFileBytes:1_000_000_000});
test('storage, entries and sharing panels use shared section headings and separate count badges, retaining section ids and primary forms',()=>{
  const page=load(renderToStaticMarkup(React.createElement(component('app/files/file-manager.tsx').default,{initial:empty()}))),storage=page('[data-section="upload"] .files-panel');
  assert.equal(storage.find('.section-heading h2').text(),'Tároló');assert.equal(storage.attr('aria-labelledby'),storage.find('h2').attr('id'));
  assert.equal(page('.files-panel').length,3);assert.equal(page('.files-panel > .section-heading').length,3);
  assert.equal(page('[data-section="entries"] h2 span').text(),'0 bejegyzés');assert.equal(page('[data-section="links"] h2 span').text(),'0');
  assert.deepEqual(page('[data-section]').map((_,element)=>page(element).attr('data-section')).get(),['upload','entries','links']);
  assert.equal(storage.find('form > button.primary-button').length,2);assert.equal(storage.find('input:not([type])').attr('maxlength'),'180');assert.equal(storage.find('input[type="file"][multiple][required]').length,1);
  const css=source('app/files/files.css');assert.match(css,/\.files-panel input,\.files-panel select\{[^}]*margin:0/);assert.match(css,/\.files-tools>form\{[^}]*grid-template-columns:minmax\(0,1fr\)/);assert.doesNotMatch(css,/\.files-panel\{[^}]*margin-bottom/);
});
test('folder names remain escaped in the shared entries heading while breadcrumbs retain navigation',()=>{
  const folder={id:'a'.repeat(32),name:'Mappa <script> & hosszú név',parent_id:null,kind:'folder',state:'ready',size:0,sha256:null,created_at:1};
  const page=load(renderToStaticMarkup(React.createElement(component('app/files/file-manager.tsx').default,{initial:{...empty(),folder,breadcrumbs:[folder]}}))),heading=page('[data-section="entries"] h2');
  assert.equal(heading.clone().children().remove().end().text().trim(),folder.name);assert.equal(heading.find('script').length,0);assert.equal(heading.find('span').text(),'0 bejegyzés');assert.equal(page('nav a[aria-current="page"]').attr('href'),'/files?folder='+folder.id);
});
test('folder breadcrumbs form one ordered path with a current-page marker and menu-independent link styles',()=>{
  const parent={id:'a'.repeat(32),name:'Dokumentumok',parent_id:null,kind:'folder',state:'ready',size:0,sha256:null,created_at:1},folder={...parent,id:'b'.repeat(32),name:'Hosszú mappa <teszt>',parent_id:parent.id};
  const page=load(renderToStaticMarkup(React.createElement(component('app/files/file-manager.tsx').default,{initial:{...empty(),folder,breadcrumbs:[parent,folder]}}))),nav=page('nav[aria-label="Fájlmappa"]');
  assert.equal(nav.find('ol > li').length,3);assert.deepEqual(nav.find('ol > li > a').map((_,a)=>page(a).text()).get(),['Tároló',parent.name,folder.name]);assert.equal(nav.find('a[aria-current="page"]').attr('href'),'/files?folder='+folder.id);assert.equal(nav.find('li > span[aria-hidden="true"]').length,2);assert.equal(nav.find('script').length,0);
  const root=load(renderToStaticMarkup(React.createElement(component('app/files/file-manager.tsx').default,{initial:empty()})));assert.equal(root('.files-breadcrumbs').length,0);assert.equal(root('[data-section="upload"] h2').text(),'Tároló');
  const css=source('app/files/files.css');assert.match(css,/\.files-breadcrumbs li\{display:flex;align-items:baseline/);assert.match(css,/\.files-page \.files-breadcrumbs a\{[^}]*padding:0;margin:0/);assert.match(css,/overflow-wrap:anywhere/);
});
test('the Hungarian styled picker retains a real required multi-file control, descriptive status and keyboard focus',()=>{
  const page=load(renderToStaticMarkup(React.createElement(component('app/files/file-manager.tsx').default,{initial:empty()}))),input=page('.files-file-picker input[type="file"][multiple][required]');
  assert.equal(input.length,1);assert.equal(input.attr('aria-label'),'Fájlok kiválasztása');assert.equal(page('.files-file-selection').attr('id'),input.attr('aria-describedby'));assert.equal(page('.files-file-selection[aria-live="polite"]').text(),'Nincs kiválasztott fájl');assert.equal(page('.files-file-picker-button[aria-hidden="true"]').text(),'Fájlok kiválasztása');assert.doesNotMatch(page.text(),/Choose Files|No file chosen/);
  const css=source('app/files/files.css');assert.match(css,/\.files-panel \.files-file-picker input\{[^}]*opacity:0;cursor:pointer/);assert.doesNotMatch(css,/\.files[^{}]*input[^{}]*\{[^}]*display:none/);assert.match(css,/\.files-file-picker:focus-within\{outline:2px solid var\(--accent\)/);assert.match(css,/\.files-file-picker:has\(input:disabled\)/);assert.match(css,/@media\(max-width:1100px\)\{\.files-tools\{grid-template-columns:1fr\}/);assert.match(css,/@media\(max-width:720px\)\{\.files-tools>form\{grid-template-columns:1fr\}/);
});
test('file selection updates name/count; raw sequential uploads clear it only on success and preserve it on cancellation/size errors',async()=>{
  const states:any[]=[];let cursor=0,hold=false;const requests:any[]=[],refreshes:string[]=[];
  const hooks={useState(value:unknown){const index=cursor++;if(!(index in states))states[index]=value;return [states[index],(next:any)=>{states[index]=typeof next==='function'?next(states[index]):next;}];},useRef(value:unknown){const index=cursor++;if(!(index in states))states[index]={current:value};return states[index];},useEffect(){},useId(){return 'synthetic-file-selection';}};
  class RequestMock {upload:any={};status=201;responseText='{"ok":true}';headers:Record<string,string>={};method='';url='';file:unknown;onload?:()=>void;onabort?:()=>void;timeout=0;constructor(){requests.push(this);}open(method:string,url:string){this.method=method;this.url=url;}setRequestHeader(key:string,value:string){this.headers[key]=value;}send(file:unknown){this.file=file;if(!hold)queueMicrotask(()=>this.onload?.());}abort(){this.onabort?.();}}
  const initial=empty(),Manager=component('app/files/file-manager.tsx',hooks,{XMLHttpRequest:RequestMock,fetch:async(path:string)=>{refreshes.push(path);return Response.json(initial);}}).default;
  function nodes(tree:any,predicate:(node:any)=>boolean):any[]{if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,predicate));return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
  const render=()=>{cursor=0;return Manager({initial});},input=()=>nodes(render(),node=>node.type==='input'&&node.props.type==='file')[0],caption=()=>nodes(render(),node=>node.props?.className==='files-file-selection')[0].props.children;
  const native:any={files:[]};let nativeValue='';Object.defineProperty(native,'value',{get:()=>nativeValue,set(value){nativeValue=value;if(value==='')native.files=[];}});input().props.ref.current=native;
  function choose(files:any[]){native.files=files;native.value=files.length?'synthetic-selection':'';input().props.onChange({target:{files}});}
  const submit=()=>nodes(render(),node=>node.type==='form')[1].props.onSubmit({preventDefault(){}});
  assert.equal(caption(),'Nincs kiválasztott fájl');const first=new File(['one'],'Első.txt'),second=new File(['two'],'Második.txt');choose([first]);assert.equal(caption(),'Első.txt');choose([first,second]);assert.equal(caption(),'2 fájl kiválasztva');assert.equal(nodes(render(),node=>node.props?.className==='files-file-picker')[0].props.title,'Első.txt, Második.txt');
  await submit();assert.equal(requests.length,2);assert.deepEqual(requests.map(request=>request.file),[first,second]);assert.ok(requests.every(request=>request.method==='POST'&&request.headers['Content-Type']==='application/octet-stream'&&request.timeout===3_600_000));assert.equal(caption(),'Nincs kiválasztott fájl');assert.equal(native.value,'');assert.deepEqual(refreshes,['/api/files']);
  hold=true;choose([first]);const pending=submit();assert.equal(input().props.disabled,true);nodes(render(),node=>node.type==='button'&&node.props.children==='Megszakítás')[0].props.onClick();await pending;assert.equal(caption(),'Első.txt');assert.equal(native.value,'synthetic-selection');assert.equal(input().props.disabled,false);assert.match(nodes(render(),node=>node.props?.className==='files-error')[0].props.children,/megszakítva/);
  const count=requests.length;choose([{name:'Túl nagy.bin',size:1_000_000_001}]);await submit();assert.equal(requests.length,count);assert.equal(caption(),'Túl nagy.bin');assert.equal(native.value,'synthetic-selection');assert.match(nodes(render(),node=>node.props?.className==='files-error')[0].props.children,/legfeljebb 1 GB/);
  choose([]);assert.equal(caption(),'Nincs kiválasztott fájl');
});
