import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import ts from 'typescript';
import { initializeFinance } from '../lib/finance/schema.ts';
import { readFinanceSnapshot } from '../lib/finance/store.ts';
const require=createRequire(import.meta.url);
function component(path:string):any {
  const src=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const output=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:Record<string,any>={};new Function('require','exports',output)((name:string)=>{
    if(name==='react' || name==='react/jsx-runtime')return require(name);
    if(name==='@/lib/finance/types')return require('../lib/finance/types.ts');
    if(name==='@/lib/finance/market-types')return require('../lib/finance/market-types.ts');
    if(name==='@/lib/finance/inflation-types')return require('../lib/finance/inflation-types.ts');
    if(name==='@/lib/finance/lego-types')return require('../lib/finance/lego-types.ts');
    if(name==='@/lib/finance/editor-types')return require('../lib/finance/editor-types.ts');
    if(name==='@/lib/finance/input-types')return require('../lib/finance/input-types.ts');
    if(name==='@/lib/finance/chart-types')return require('../lib/finance/chart-types.ts');
    if(name==='@/lib/finance/collection-growth-types')return require('../lib/finance/collection-growth-types.ts');
    if(name==='./integer-amount-input' || name==='../finance/integer-amount-input')return component('app/finance/integer-amount-input.tsx');
    if(name==='./finance-chart')return component('app/finance/finance-chart.tsx');
    if(name==='./real-growth')return component('app/finance/real-growth.tsx');
    if(name==='./composition')return component('app/finance/composition.tsx');
    if(name==='../finance-actions')return {};
    if(name==='./lego-actions')return {};
    if(name==='./pokemon-actions')return {};
    if(name==='../action-form')return {ActionForm:({children}:any)=>React.createElement('form',{},children),ActionButton:({children}:any)=>React.createElement('button',{},children)};
    throw new Error('Unexpected import '+name);
  },exports);return exports;
}
function snapshot(){const db=new DatabaseSync(':memory:');initializeFinance(db);db.exec(`
  INSERT INTO finance_accounts VALUES('bank','Demo Bank','Banks','asset',1,NULL),('child','Child','Debt','debt',2,11);
  INSERT INTO finance_months(month,as_of,source,excel_total_minor,note,updated_at) VALUES('2025-09','2025-09-01','excel',80000,'','2025-09-01'),('2026-08','2026-08-01','excel',100000,'','2026-08-01'),('2026-09','2026-09-01','excel',110000,'','2026-09-01');
  INSERT INTO finance_balances VALUES('2025-09','bank',80000,0,NULL),('2026-08','bank',100000,0,NULL),('2026-09','bank',130000,0,NULL),('2026-09','child',-20000,1,NULL);
`);try{return readFinanceSnapshot(db);}finally{db.close();}}
test('finance UI exposes default latest period, full-history selector, corrected totals, debt markers and integer-backed table',()=>{
  const View=component('app/finance/finance-view.tsx').default,page=load(renderToStaticMarkup(React.createElement(View,{snapshot:snapshot()})));
  assert.equal(page('#finance-month option').length,3);assert.equal(page('#finance-month option[selected]').val(),'2026-09');
  assert.equal(page('.finance-kpi').length,4);assert.equal(page('.finance-chart').length,1);assert.match(page.text(),/Nettó vagyon|Mi változott leginkább/);
  assert.match(page.text(),/Child/);assert.match(page.text(),/kamatjóváírás jelölve/);assert.match(page.text(),/Demo Bank/);
  assert.equal(page('a[href="/finance?month=2025-09"]').length>0,true);assert.match(page.text(),/nem.*hozam/);
  assert.equal(page('[href="#monthly-entry"]').length,1);
  assert.equal(page('.finance-pie').length,1);assert.equal(page('#real-growth-title').length,1);
  assert.doesNotMatch(page.text(),/Adatforrás és ellenőrzés|Eredeti Excel-összesítés|Excel-különbség/);
});
test('finance editor month text moves forward with latest state; Collectr prefills USD and other USD inputs never copy old Ft',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default;
  data.selected!.month='2026-10';data.selected!.as_of='2026-10-02';
  data.accounts.push({id:'cashflow-row-17',name:'Ledger',category:'Crypto',kind:'asset',sort_order:17,turnover_month:null},{id:'cashflow-row-35',name:'eToro (stock)',category:'Stock',kind:'asset',sort_order:35,turnover_month:null},{id:'cashflow-row-45',name:'PokeMon',category:'Collectibles',kind:'asset',sort_order:45,turnover_month:null});
  for(const account_id of ['cashflow-row-17','cashflow-row-35','cashflow-row-45'])data.balances.push({account_id,amount_minor:9999900,turnover:0,source_cell:null});
  const market={rates:{date:'2026-10-02',usdHuf:300,eurHuf:350,fetchedAt:'2026-10-02T00:00:00Z'},collectr:{usdMinor:123456,fetchedAt:'2026-10-02T00:00:00Z'},rateError:null,collectrError:null,inflation:null,inflationError:null};
  const page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,market})));
  assert.match(page.text(),/2026\. október értékeiből indul/);assert.equal(page('input[name="month"]').val(),'2026-11');
  assert.equal(page('input[name="amount:cashflow-row-17"]').val(),'');assert.equal(page('input[name="amount:cashflow-row-35"]').val(),'');
  assert.equal(page('input[name="amount:cashflow-row-45"]').val(),'1234');assert.equal(page('select[name="currency:cashflow-row-45"]').val(),'USD');
  assert.equal(page('input[name="fx_date"]').val(),'2026-10-02');assert.match(page.text(),/mentés Ft-ban/);
});
test('composition pie excludes debt even if an asset and liability share the same category',()=>{
  const data=snapshot();data.accounts[1].category='Banks';const Composition=component('app/finance/composition.tsx').default;
  const page=load(renderToStaticMarkup(React.createElement(Composition,{snapshot:data})));
  assert.equal(page('.finance-pie-legend li').length,1);assert.match(page('.finance-pie-legend').text(),/100%/);assert.match(page('.finance-composition-debt').text(),/-200/);
});
test('eToro editor displays Total Balance prefill with fetch time, explicit save and untouched empty crypto row',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default;
  for(const [id,name]of [['cashflow-row-35','eToro (stock)'],['cashflow-row-19','crypto (etoro)']] as const)data.accounts.push({id,name,category:'Test',kind:'asset',sort_order:35,turnover_month:null});
  const market={rates:{date:'2026-10-02',usdHuf:300,eurHuf:350,fetchedAt:'2026-10-02T00:00:00Z'},collectr:null,inflation:null,rateError:null,collectrError:null,inflationError:null,etoro:{usdMinor:98765,fetchedAt:'2026-10-03T09:30:00Z'}};
  const page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,market})));
  assert.equal(page('input[name="amount:cashflow-row-35"]').val(),'987');assert.equal(page('select[name="currency:cashflow-row-35"]').val(),'USD');
  assert.equal(page('input[name="amount:cashflow-row-19"]').val(),'');assert.match(page.text(),/Total Balance/);assert.match(page.text(),/készpénzzel és kriptóval együtt/);assert.match(page.text(),/2026-10-03 09:30 UTC/);
  assert.equal(page('input[name="confirmed"][required]').length,1);assert.match(page.text(),/mentés Ft-ban/);
  const unavailable=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,market:{...market,etoro:null,etoroError:'eToro nem érhető el'}})));
  assert.equal(unavailable('input[name="amount:cashflow-row-35"]').val(),'');assert.match(unavailable('[role="alert"]').text(),/eToro nem érhető el/);
});
test('new-month LEGO prefill uses live inventory total rather than last month, including a zero total',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default;
  data.accounts.push({id:'cashflow-row-46',name:'LEGO',category:'Collectibles',kind:'asset',sort_order:46,turnover_month:null});data.balances.push({account_id:'cashflow-row-46',amount_minor:10000,turnover:0,source_cell:null});
  for(const legoTotal of [50079300,0]){const page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,legoTotal})));assert.equal(page('input[name="amount:cashflow-row-46"]').val(),String(legoTotal/100));}
});
test('only the four Lili/Bali DEBT fields carry forward; bank, other liabilities and named non-DEBT assets start blank',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default;
  for(const [index,name] of ['Lili · 1','Lili · 2','Bali · 1','Bali · 2'].entries()){const id='cashflow-row-'+(index+5);data.accounts.push({id,name,category:'DEBT',kind:'debt',sort_order:index+5,turnover_month:1});data.balances.push({account_id:id,amount_minor:-123400,turnover:0,source_cell:null});}
  data.accounts.push({id:'lili-asset',name:'Lili','category':'Savings',kind:'asset',sort_order:99,turnover_month:null});data.balances.push({account_id:'lili-asset',amount_minor:99000,turnover:0,source_cell:null});
  const page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances})));
  for(const id of ['cashflow-row-5','cashflow-row-6','cashflow-row-7','cashflow-row-8'])assert.equal(page(`input[name="amount:${id}"]`).val(),'-1234');
  for(const id of ['bank','child','lili-asset'])assert.equal(page(`input[name="amount:${id}"]`).val(),'');
});
test('LEGO inventory exposes add/edit/confirmed delete forms and missing dates without adding a second asset total',()=>{
  const Inventory=component('app/collections/lego-inventory.tsx').default;
  const item={id:'fixture',set_number:'12345',name:'Kastély',quantity:2,unit_price_minor:123400,acquired_on:null,revision:1,updated_at:'2026-10-02',deleted_at:null};
  const page=load(renderToStaticMarkup(React.createElement(Inventory,{snapshot:{items:[item],quantity:2,totalMinor:246800}})));
  assert.equal(page('#lego-inventory').length,1);assert.equal(page('form').length,3);assert.equal(page('input[name="confirmed"][required]').length,1);assert.match(page.text(),/Ismeretlen/);assert.match(page.text(),/nem adódnak hozzá másodszor/);
});
test('Pokemon purchase inventory exposes integer-price audited CRUD forms, separate repeated purchases and unknown dates',()=>{
  const Inventory=component('app/collections/pokemon-inventory.tsx').default;
  const item={id:'fixture',name:'Demo box',quantity:2,unit_price_minor:123400,acquired_on:'2026-01-02',revision:1,updated_at:'2026-10-02',deleted_at:null};
  const page=load(renderToStaticMarkup(React.createElement(Inventory,{snapshot:{items:[item,{...item,id:'second',acquired_on:null}],quantity:4,totalMinor:493600}})));
  assert.equal(page('#pokemon-inventory').length,1);assert.equal(page('form').length,5);assert.equal(page('input[name="confirmed"][required]').length,2);assert.equal(page('input[name="unit_price"][pattern="[0-9]+"]').length,3);assert.match(page.text(),/Ismeretlen|Collectr/);assert.equal(page('.finance-table tbody tr').length,2);
});
test('collection growth renders separate saved-value/cost/nominal/real cards without editing or duplicating wealth',()=>{
  const Growth=component('app/finance/collection-growth.tsx').default,data=snapshot();data.selected!.as_of='2026-09-30';
  data.balances.push({account_id:'cashflow-row-45',amount_minor:20000,turnover:0,source_cell:null},{account_id:'cashflow-row-46',amount_minor:15000,turnover:0,source_cell:null});
  const item={id:'purchase',name:'Demo',quantity:1,unit_price_minor:10000,acquired_on:'2026-09-03',revision:1,updated_at:'2026-09-03',deleted_at:null};
  const page=load(renderToStaticMarkup(React.createElement(Growth,{snapshot:data,lego:{items:[{...item,set_number:'12345'}],quantity:1,totalMinor:10000},pokemon:{items:[item],quantity:1,totalMinor:10000}})));
  assert.equal(page('#collection-growth').length,1);assert.equal(page('.collection-growth-card').length,2);assert.equal(page('form,input').length,0);assert.match(page.text(),/Nominális gyarapodás|Reálgyarapodás/);assert.match(page.text(),/\+100\s*Ft/);assert.match(page.text(),/\+100%/);assert.equal(page('a[href="/collections"]').attr('target'),'_blank');
  const finance=readFileSync(new URL('../app/finance/page.tsx',import.meta.url),'utf8');assert.match(finance,/CollectionGrowthSection snapshot=\{latest\}/);assert.doesNotMatch(finance,/LegoInventory/);
});
test('finance monthly editor contains complete account fields, explicit confirmation and no automatic interest credit',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default,page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances})));
  assert.equal(page('input[name="month"]').val(),'2026-10');assert.equal(page('input[name="revision"]').val(),'0');
  assert.equal(page('input[name^="amount:"]').length,2);assert.equal(page('input[name="confirmed"][required]').length,1);
   assert.equal(page('input[name="turnover:child"][checked]').length,0);assert.match(page.text(),/nem visszamenőleges havi adatok/);
});
test('every monthly amount has an accessible previous-value hint below its textbox, including missing and zero balances',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default;
  data.accounts.push({id:'empty',name:'Empty',category:'Test',kind:'asset',sort_order:99,turnover_month:null});
  data.balances[0].amount_minor=0;
  const page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,previous:data.previous,previousBalances:data.previousBalances})));
  assert.equal(page('.finance-previous').length,data.accounts.length);
  for(const account of data.accounts){const input=page(`input[name="amount:${account.id}"]`),hint=page('#previous-'+account.id);assert.equal(input.attr('aria-describedby'),'previous-'+account.id);assert.equal(input.parent().find('.finance-previous').length,1);assert.equal(input.attr('pattern'),'-?[0-9]+');assert.match(hint.text(),/2026\. szeptember/);}
  assert.match(page('#previous-bank').text(),/0\s*Ft/);assert.match(page('#previous-empty').text(),/nincs rögzítve/);
  const source=readFileSync(new URL('../app/finance/finance-editor.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/key=\{[^\n]*accounts\.length/);assert.match(source,/previousBalances/);
});
test('finance guards precede database reads; worker installer includes the new schema dependency',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const page=source('app/finance/page.tsx');assert.ok(page.indexOf("if(session.role!=='admin')")<page.indexOf('readFinanceSnapshot(db()'));
  assert.match(source('app/api/finance/route.ts'),/await requireAdmin\(\)/);assert.match(source('scripts/Install-Pokemon-Worker.ps1'),/lib\\finance/);
});
