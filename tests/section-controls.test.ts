import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function browser(value:string|null=null){
  const values=new Map<string,string>(),listeners=new Set<(event:any)=>void>(),blocked={read:false,write:false};
  if(value!==null)values.set('wydrian:section-controls:v1',value);
  const storage={getItem(key:string){if(blocked.read)throw Error('Storage blocked');return values.get(key)??null;},setItem(key:string,value:string){if(blocked.write)throw Error('Storage blocked');values.set(key,value);}};
  const window={localStorage:storage,addEventListener(name:string,listener:(event:any)=>void){assert.equal(name,'storage');listeners.add(listener);},removeEventListener(name:string,listener:(event:any)=>void){assert.equal(name,'storage');listeners.delete(listener);}};
  const output=ts.transpileModule(source('lib/section-controls.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const api={} as typeof import('../lib/section-controls.ts');new Function('exports','window',output)(api,window);
  function change(key:string|null,newValue:string|null,storageArea:unknown=storage){for(const listener of listeners)listener({key,newValue,storageArea});}
  return {api,values,blocked,listeners,change,storage};
}
test('section arrows start hidden on the server and browser; only an explicit true preference restores them',()=>{
  for(const value of [null,'false','1','TRUE','{}','"true"','{bad']){const {api}=browser(value);assert.equal(api.sectionControlsServerSnapshot(),false);assert.equal(api.sectionControlsVisible(),false);const stop=api.subscribeSectionControls(()=>{});assert.equal(api.sectionControlsVisible(),false);stop();}
  const {api}=browser('true');assert.equal(api.sectionControlsServerSnapshot(),false);assert.equal(api.sectionControlsVisible(),false);const stop=api.subscribeSectionControls(()=>{});assert.equal(api.sectionControlsVisible(),true);assert.equal(api.sectionControlsServerSnapshot(),false);stop();
});
test('one visibility choice updates all page subscribers, survives navigation/reload and never changes saved ordering',()=>{
  const {api,values,listeners}=browser();values.set('wydrian:sections:v1:finance','["balances","composition"]');let finance=0,notes=0;
  const stopFinance=api.subscribeSectionControls(()=>finance++),stopNotes=api.subscribeSectionControls(()=>notes++);assert.equal(listeners.size,1);
  assert.equal(api.setSectionControlsVisible(true),true);assert.equal(api.sectionControlsVisible(),true);assert.equal(finance,1);assert.equal(notes,1);assert.equal(values.get(api.SECTION_CONTROLS_KEY),'true');
  stopFinance();stopNotes();assert.equal(listeners.size,0);const stopPokemon=api.subscribeSectionControls(()=>{});assert.equal(api.sectionControlsVisible(),true);stopPokemon();
  const reloaded=browser(values.get(api.SECTION_CONTROLS_KEY));const stopReloaded=reloaded.api.subscribeSectionControls(()=>{});assert.equal(reloaded.api.sectionControlsVisible(),true);stopReloaded();
  assert.equal(api.setSectionControlsVisible(false),true);assert.equal(api.sectionControlsVisible(),false);assert.equal(values.get(api.SECTION_CONTROLS_KEY),'false');assert.equal(values.get('wydrian:sections:v1:finance'),'["balances","composition"]');
});
test('other same-origin tabs can enable, disable or clear visibility; unrelated and session storage changes are ignored',()=>{
  const {api,change,storage,listeners}=browser();let updates=0;const stop=api.subscribeSectionControls(()=>updates++);
  change('unrelated','true');change(api.SECTION_CONTROLS_KEY,'true',{});assert.equal(updates,0);
  change(api.SECTION_CONTROLS_KEY,'true',storage);assert.equal(api.sectionControlsVisible(),true);change(api.SECTION_CONTROLS_KEY,'true',storage);assert.equal(updates,1);
  change(api.SECTION_CONTROLS_KEY,'false',storage);assert.equal(api.sectionControlsVisible(),false);change(api.SECTION_CONTROLS_KEY,'true',storage);change(null,null,storage);assert.equal(api.sectionControlsVisible(),false);
  change(api.SECTION_CONTROLS_KEY,'corrupt',storage);assert.equal(api.sectionControlsVisible(),false);assert.equal(updates,4);stop();assert.equal(listeners.size,0);
});
test('blocked reads/writes preserve one in-memory toggle across page remounts and recover when persistence becomes available',()=>{
  const {api,blocked,values}=browser();blocked.read=true;blocked.write=true;const stop=api.subscribeSectionControls(()=>{});
  assert.equal(api.sectionControlsVisible(),false);assert.equal(api.setSectionControlsVisible(true),false);assert.equal(api.sectionControlsVisible(),true);stop();
  blocked.read=false;const stopNext=api.subscribeSectionControls(()=>{});assert.equal(api.sectionControlsVisible(),true);assert.equal(values.has(api.SECTION_CONTROLS_KEY),false);
  assert.equal(api.setSectionControlsVisible(false),false);assert.equal(api.sectionControlsVisible(),false);blocked.write=false;assert.equal(api.setSectionControlsVisible(true),true);assert.equal(values.get(api.SECTION_CONTROLS_KEY),'true');stopNext();
});
test('server markup hides every rail and provides one accessible non-submit toggle after all page sections',()=>{
  const output=ts.transpileModule(source('app/local-sections.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:Record<string,any>={};new Function('require','exports',output)((name:string)=>name==='@/lib/section-order'?require('../lib/section-order.ts'):name==='@/lib/section-controls'?require('../lib/section-controls.ts'):require(name),exports);
  const markup=renderToStaticMarkup(React.createElement(exports.default,{page:'demo'},React.createElement(exports.LocalSection,{sectionId:'one',label:'Egy'},React.createElement('input',{defaultValue:'Draft'})),React.createElement(exports.LocalSection,{sectionId:'two',label:'Kettő'},'Two'))),page=load(markup);
  assert.equal(page('.section-order-controls[hidden]').length,2);assert.equal(page('.section-order-controls button[type="button"]').length,4);assert.equal(page('.local-sections').children().last().attr('class'),'section-order-toggle');
  const toggle=page('.section-order-toggle button');assert.equal(toggle.length,1);assert.equal(toggle.attr('type'),'button');assert.equal(toggle.attr('aria-pressed'),'false');assert.equal(toggle.attr('aria-label'),'Szekciórendező nyilak');assert.match(toggle.text(),/megjelenítése/);
  const css=source('app/globals.css');assert.match(css,/\.section-order-controls\[hidden\]\{display:none\}/);assert.match(css,/\.local-section-content\{flex:1;min-width:0\}/);assert.match(css,/\.section-order-toggle button\{min-height:44px/);
  assert.doesNotMatch(source('lib/section-controls.ts'),/fetch\(|document\.cookie|\/api\//);
});
