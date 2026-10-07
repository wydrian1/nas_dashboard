import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import ts from 'typescript';
import { initializeDatabase } from '../lib/db-schema.ts';
import { readPokemonSnapshot } from '../lib/pokemon/snapshot.ts';
import { SHOP_IDS } from '../lib/pokemon/types.ts';
import type {LatestInfoFinance} from '../lib/important-info/store.ts';
import {formatMoney} from '../lib/finance/types.ts';

const require = createRequire(import.meta.url);
const source = (path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
// Render the real TSX with server-action/form boundaries stubbed; no production data or authentication is changed.
function component(path:string) {
  const output=ts.transpileModule(source(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:Record<string,any>={};
  new Function('require','exports',output)((name:string)=>{
    if(name==='react' || name==='react/jsx-runtime')return require(name);
    if(name==='./action-form')return {
      ActionForm:({children,className}:any)=>React.createElement('form',{className},children),
      ActionButton:({children,className}:any)=>React.createElement('button',{className},children)
    };
    if(name==='@/lib/personal-types')return require('../lib/personal-types.ts');
    if(name==='@/lib/finance/types')return require('../lib/finance/types.ts');
    if(name==='@/lib/mobile/task-reminders')return require('../lib/mobile/task-reminders.ts');
    if(name==='@/lib/mobile/release')return require('../lib/mobile/release.ts');
    if(name==='./pokemon-search')return require('../app/pokemon-search.ts');
    if(['./personal-actions','./pokemon-actions','./actions'].includes(name))return {};
    throw new Error('Unexpected component dependency: '+name);
  },exports);
  return exports;
}

test('Important info hides missing balances and empty groups but retains saved zero/negative values and unchanged totals',()=>{
  const View=component('app/important-info/finance.tsx').default;
  const finance:NonNullable<LatestInfoFinance>={month:'2026-09',asOf:'2026-09-30',netMinor:7500,assetsMinor:10000,debtMinor:-2500,groups:[
    {category:'Mixed',totalMinor:7500,items:[
      {id:'asset',name:'Saved asset',category:'Mixed',kind:'asset',amountMinor:10000},
      {id:'missing',name:'Missing mixed row',category:'Mixed',kind:'asset',amountMinor:null},
      {id:'zero',name:'Saved zero',category:'Mixed',kind:'asset',amountMinor:0},
      {id:'debt',name:'Saved debt',category:'Mixed',kind:'debt',amountMinor:-2500}]},
    {category:'Only missing',totalMinor:0,items:[{id:'empty',name:'Missing-only row',category:'Only missing',kind:'asset',amountMinor:null}]},
    {category:'Zero-only group',totalMinor:0,items:[{id:'zero-only',name:'Zero-only row',category:'Zero-only group',kind:'asset',amountMinor:0}]},
    {category:'No items',totalMinor:0,items:[]}
  ]};
  const before=JSON.stringify(finance),page=load(renderToStaticMarkup(React.createElement(View,{finance})));
  assert.equal(page('.info-table tbody tr').length,4);assert.deepEqual(page('.info-groups h3').map((_,el)=>page(el).text()).get(),['Mixed','Zero-only group']);
  assert.doesNotMatch(page.text(),/Missing mixed row|Only missing|Missing-only row|No items|Nincs rögzített érték/);
  assert.deepEqual(page('.info-table tbody td').map((_,el)=>page(el).text()).get(),[10000,0,-2500,0].map(formatMoney));
  assert.deepEqual(page('.info-totals strong').map((_,el)=>page(el).text()).get(),[7500,10000,-2500].map(formatMoney));assert.equal(JSON.stringify(finance),before);
  const allMissing=load(renderToStaticMarkup(React.createElement(View,{finance:{...finance,groups:[finance.groups[1]]}})));assert.equal(allMissing('.info-groups .info-card,.info-table tbody tr').length,0);assert.equal(allMissing('.info-totals strong').length,3);
  const absent=load(renderToStaticMarkup(React.createElement(View,{finance:null})));assert.match(absent.text(),/Még nincs mentett pénzügyi hónap/);
});

test('overview quick links are read-only; add/edit/delete controls live in configuration',()=>{
  const {QuickLinks,QuickLinkSettings}=component('app/personal-sections.tsx');
  const links=[{id:1,title:'Example',url:'https://example.com/',description:'Saved link',updated_at:1}];
  const overview=load(renderToStaticMarkup(React.createElement(QuickLinks,{links})));
  assert.equal(overview('form').length,0);
  assert.equal(overview('a[href="/config#quicklinks"]').text(),'Konfig →');
  assert.equal(overview('a[href="https://example.com/"]').attr('target'),'_blank');
  const settings=load(renderToStaticMarkup(React.createElement(QuickLinkSettings,{links})));
  assert.equal(settings('form').length,3);
  assert.equal(settings('input[name="title"]').length,2);
  assert.match(settings.text(),/Link törlése/);
});

test('sidebar news/config/notes destinations are separate pages with active-page markers',()=>{
  const Sidebar=component('app/dashboard-sidebar.tsx').default;
  for(const active of ['news','config','notes','finance','collections','files']){
    const page=load(renderToStaticMarkup(React.createElement(Sidebar,{active,unread:3})));
    assert.equal(page(`a[href="/${active}"]`).attr('aria-current'),'page');
    assert.equal(page('a[aria-current="page"]').length,1);
    assert.equal(page('a[href="/#news"],a[href="/#sources"],a[href="/#notes"]').length,0);
  }
});
test('admin menu starts with Dashboard and news; dashboard sections and phone management are not separate menu items',()=>{
  const Sidebar=component('app/dashboard-sidebar.tsx').default;
  const page=load(renderToStaticMarkup(React.createElement(Sidebar,{active:'overview'})));
  assert.deepEqual(page('nav a').map((_,el)=>page(el).attr('href')).get(),['/','/news','/finance','/collections','/files','/notes','/pokemon','/important-info','/config']);
  assert.equal(page('nav a').first().find('span').text(),'Dashboard');assert.equal(page('nav a').eq(1).find('span').text(),'Hírolvasó');
  assert.equal(page('nav a').first().attr('aria-current'),'page');
  assert.equal(page('nav a[href="/mobile"],nav a[href^="/#"]').length,0);
  const dashboard=source('app/page.tsx');assert.match(dashboard,/<h1>Dashboard<\/h1>/);assert.doesNotMatch(dashboard,/A te központod\.|Nézz rá a szolgáltatásaidra/);
});
test('phone settings live under admin configuration; legacy route redirects and revoke invalidates configuration',()=>{
  assert.match(source('app/config/page.tsx'),/<MobileSettings\s*\/>/);assert.match(source('app/config/page.tsx'),/href="#mobile"/);
  const settings=source('app/mobile/settings.tsx');assert.ok(settings.indexOf('await requireAdmin()')<settings.indexOf('const devices='));
  assert.match(settings,/id="mobile"/);assert.match(settings,/action=\{mobileRevoke\}/);
  assert.match(source('app/mobile/page.tsx'),/redirect\('\/config#mobile'\)/);
  assert.match(source('app/mobile/actions.ts'),/revalidatePath\('\/config'\)/);
});
test('OpenCode owner menu is opt-in and never appears for Pokemon readers',()=>{
  const Sidebar=component('app/dashboard-sidebar.tsx').default;
  const owner=load(renderToStaticMarkup(React.createElement(Sidebar,{active:'opencode',openCode:true})));
  assert.equal(owner('nav a[href="/opencode"]').attr('aria-current'),'page');
  assert.deepEqual(owner('nav a').map((_,el)=>owner(el).attr('href')).get(),['/','/news','/finance','/collections','/files','/notes','/pokemon','/important-info','/opencode','/config']);
  const reader=load(renderToStaticMarkup(React.createElement(Sidebar,{role:'pokemon-reader',openCode:true})));
  assert.equal(reader('nav a[href="/opencode"]').length,0);
  assert.match(source('app/opencode/page.tsx'),/if\(!isOpenCodeOwner\(session.user\?\.email\)\)redirect\('\/'\)/);
  for(const path of ['app/page.tsx','app/news/page.tsx','app/finance/page.tsx','app/notes/page.tsx','app/pokemon/page.tsx','app/config/page.tsx'])assert.match(source(path),/openCode=\{isOpenCodeOwner\(session\??\.user\?\.email\)\}/);
});

test('notes page is private and keeps existing note/task editors, including completed tasks',()=>{
  const text=source('app/notes/page.tsx');
  assert.ok(text.indexOf('await requireUser()')<text.indexOf('const personal = personalData(session.user!.email!)'));
  assert.match(text,/if \(!session\) redirect\("\/"\)/);
  assert.match(text,/<NotesAndTasks notes=\{personal.notes\} todos=\{personal.todos\}/);
  assert.doesNotMatch(source('app/page.tsx'),/NotesAndTasks/);
  assert.match(source('app/personal-actions.ts'),/revalidatePath\("\/notes"\)/);
  const Notes=component('app/personal-sections.tsx').NotesAndTasks;
  const page=load(renderToStaticMarkup(React.createElement(Notes,{
    notes:[{id:1,title:'Saved note',content:'Existing content',updated_at:1}],
    todos:[{id:1,text:'Pending task',done:0},{id:2,text:'Completed task',done:1}]
  })));
  assert.match(page.text(),/Saved note/);assert.match(page.text(),/Existing content/);
  assert.equal(page('.todo-list .todo-item').length,2);
  assert.match(page('.completed-tasks').text(),/Completed task/);
  assert.equal(page('textarea[name="content"]').length,2);
});

test('all configured shop shortcuts precede the event feed and point to existing shop sections',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    const snapshot=readPokemonSnapshot(db),Panel=component('app/pokemon-panel.tsx').default;
    const page=load(renderToStaticMarkup(React.createElement(Panel,{initial:snapshot})));
    assert.equal(page('#pokemon').children().first().attr('aria-label'),'Ugrás a webshophoz');
    const links=page('[aria-label="Ugrás a webshophoz"] a');assert.equal(links.length,SHOP_IDS.length);
    assert.equal(page('input[name="interval"][min="3"][max="60"][value="3"]').length,SHOP_IDS.length);
    snapshot.shops.forEach(({shop},index)=>{
      assert.equal(links.eq(index).text(),shop.name);assert.equal(links.eq(index).attr('href'),'#shop-'+shop.id);
      assert.equal(page('#shop-'+shop.id).length,1);
    });
  }finally{db.close();}
});

test('reader navigation exposes only Pokemon; reader settings expose only their own notification switches',()=>{
  const Sidebar=component('app/dashboard-sidebar.tsx').default;
  const nav=load(renderToStaticMarkup(React.createElement(Sidebar,{active:'pokemon',role:'pokemon-reader'})));
  assert.equal(nav('nav a').length,1);assert.equal(nav('nav a').attr('href'),'/pokemon');
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    const snapshot=readPokemonSnapshot(db,false,Date.now(),{email:'reader@example.com',role:'pokemon-reader'});
    const Panel=component('app/pokemon-panel.tsx').default;
    const page=load(renderToStaticMarkup(React.createElement(Panel,{initial:snapshot})));
    assert.equal(page('.pokemon-panel').length,SHOP_IDS.length);assert.equal(page('input[name="notifications"]').length,SHOP_IDS.length);
    assert.equal(page('input[name="interval"],input[name="enabled"],input[name="new"],input[name="restock"],input[name="preorder"]').length,0);
    assert.equal(page('a[href="/mobile"],a[href="/config#mobile"]').length,0);assert.doesNotMatch(page.text(),/Kézi vizsgálat/);
    assert.equal(page('.pokemon-products').length,SHOP_IDS.length);assert.equal(page('.pokemon-events').length,SHOP_IDS.length);
  }finally{db.close();}
});
test('info-reader navigation exposes only Important info with no Pokemon/config/finance destinations',()=>{
  const Sidebar=component('app/dashboard-sidebar.tsx').default;
  const page=load(renderToStaticMarkup(React.createElement(Sidebar,{active:'important-info',role:'info-reader',openCode:true})));
  assert.equal(page('nav a').length,1);assert.equal(page('nav a').attr('href'),'/important-info');assert.equal(page('nav a').attr('aria-current'),'page');assert.equal(page('a[href="/finance"],a[href="/pokemon"],a[href="/config"],a[href="/opencode"]').length,0);
  assert.match(page.text(),/Fontos infók/);
});

test('admin-only API and server-action guards protect the hidden features; user notifications derive identity from the session',()=>{
  for(const path of ['app/api/weather/route.ts','app/api/weather/locations/route.ts','app/api/system/route.ts','app/api/status/route.ts','app/api/finance/route.ts','app/api/finance/market/route.ts']){
    assert.match(source(path),/await requireAdmin\(\)/);
  }
   for(const path of ['app/config/page.tsx','app/news/page.tsx','app/notes/page.tsx','app/mobile/page.tsx','app/finance/page.tsx','app/collections/page.tsx','app/files/page.tsx']){
    assert.match(source(path),/session.role!==['"]admin['"]/);
  }
  assert.match(source('app/actions.ts'),/await requireAdmin\(\)/);
  assert.match(source('app/personal-actions.ts'),/await requireAdmin\(\)/);
  assert.match(source('app/mobile/actions.ts'),/await requireAdmin\(\)/);
  assert.equal((source('app/collections/lego-actions.ts').match(/await requireAdmin\(\)/g)||[]).length,2);
  assert.equal((source('app/collections/pokemon-actions.ts').match(/await requireAdmin\(\)/g)||[]).length,2);
  assert.match(source('app/api/collections/route.ts'),/await requireAdmin\(\)/);
  assert.ok(source('app/collections/page.tsx').indexOf("if(session.role!=='admin')")<source('app/collections/page.tsx').indexOf('const database=db()'));
  assert.match(source('app/user-actions.ts'),/await requireAdmin\(\)/);
  assert.equal((source('app/finance-actions.ts').match(/await requireAdmin\(\)/g)||[]).length,2);
  const pokemon=source('app/pokemon-actions.ts');assert.match(pokemon,/admin \? requireAdmin\(\) : requireUser\(\)/);
  assert.match(pokemon,/saveNotifications\(db\(\),session.user!.email!/);assert.doesNotMatch(pokemon,/data.get\(['"]email['"]\)/);
  assert.match(source('app/page.tsx'),/session\?\.role==='pokemon-reader'\)redirect\('\/pokemon'\)/);
});

test('news and config pages authenticate before reading private data; overview no longer contains feeds/forms',()=>{
  for(const path of ['app/news/page.tsx','app/config/page.tsx']){
    const text=source(path);assert.match(text,/await requireUser\(\)/);assert.match(text,/if \(!session\) redirect\("\/"\)/);
    assert.ok(text.indexOf('if (!session)')<text.indexOf('const '+(path.includes('/news/') ? 'news' : 'sources')));
  }
  const overview=source('app/page.tsx');assert.doesNotMatch(overview,/refreshFeeds|news-panel|addFeed|id="sources"/);
  const news=source('app/news/page.tsx');assert.match(news,/action=\{toggleRead\}/);assert.match(news,/action=\{refreshNews\}/);assert.match(news,/\/config#sources/);
  const config=source('app/config/page.tsx');assert.match(config,/<QuickLinkSettings/);
  for(const action of ['addFeed','removeFeed','updateFeedLimit'])assert.ok(config.includes('action={'+action+'}'));
});

test('RSS and quick-link mutations invalidate the new destinations',()=>{
  const actions=source('app/actions.ts');
  for(const path of ['/','/news','/config'])assert.ok(actions.includes('revalidatePath("'+path+'")'));
  assert.equal((actions.match(/revalidateNewsPages\(\);/g)||[]).length,5);
  assert.match(source('app/personal-actions.ts'),/revalidatePath\("\/config"\)/);
});

test('Pokemon APK download follows all shop sections and precedes the page footer',()=>{
  const page=source('app/pokemon/page.tsx'),panel=page.indexOf('<PokemonPanel'),download=page.indexOf('href="/mobile/download"'),footer=page.indexOf('<footer');
  assert.ok(panel>=0 && download>panel && footer>download);
  assert.equal((page.match(/href="\/mobile\/download"/g)||[]).length,1);
});
test('collection inventories move off finance; latest-month collection growth is below the monthly editor',()=>{
  const page=source('app/finance/page.tsx');assert.doesNotMatch(page,/LegoInventory/);assert.ok(page.indexOf('<CollectionGrowthSection')>page.indexOf('<FinanceEditor'));assert.ok(page.indexOf('<CollectionGrowthSection')<page.indexOf('<footer'));
  const collections=source('app/collections/page.tsx');assert.match(collections,/<LegoInventory/);assert.match(collections,/<PokemonInventory/);
});
