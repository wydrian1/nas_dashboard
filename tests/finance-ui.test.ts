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
import { formatMoney, formatPercent } from '../lib/finance/types.ts';
import { realGrowthPeriods, cpiGrowthPeriods } from '../lib/finance/market-types.ts';
const require=createRequire(import.meta.url);
const components=new Map<string,any>();
function component(path:string,reactModule?:unknown,extra=''):any {
  if(!reactModule&&!extra&&components.has(path))return components.get(path);
  const src=readFileSync(new URL('../'+path,import.meta.url),'utf8')+extra;
  const output=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:Record<string,any>={};new Function('require','exports',output)((name:string)=>{
    if(name==='react')return reactModule || require(name);
    if(name==='react/jsx-runtime')return require(name);
    if(name==='@/lib/section-order')return require('../lib/section-order.ts');
    if(name==='@/lib/section-controls')return require('../lib/section-controls.ts');
    if(name==='../local-sections')return component('app/local-sections.tsx');
    if(name==='./finance-view')return component('app/finance/finance-view.tsx');
    if(name==='@/lib/finance/types')return require('../lib/finance/types.ts');
    if(name==='@/lib/finance/market-types')return require('../lib/finance/market-types.ts');
    if(name==='@/lib/finance/inflation-types')return require('../lib/finance/inflation-types.ts');
    if(name==='@/lib/finance/lego-types')return require('../lib/finance/lego-types.ts');
    if(name==='@/lib/finance/editor-types')return require('../lib/finance/editor-types.ts');
    if(name==='@/lib/finance/input-types')return require('../lib/finance/input-types.ts');
    if(name==='@/lib/finance/chart-types')return require('../lib/finance/chart-types.ts');
    if(name==='@/lib/finance/collection-growth-types')return require('../lib/finance/collection-growth-types.ts');
    if(name==='@/lib/finance/valuation-quality')return require('../lib/finance/valuation-quality.ts');
    if(name==='./integer-amount-input' || name==='../finance/integer-amount-input')return component('app/finance/integer-amount-input.tsx');
    if(name==='./finance-chart')return component('app/finance/finance-chart.tsx');
    if(name==='./real-growth')return component('app/finance/real-growth.tsx');
    if(name==='./composition')return component('app/finance/composition.tsx');
    if(name==='./collection-growth')return component('app/finance/collection-growth.tsx');
    if(name==='./finance-editor')return component('app/finance/finance-editor.tsx');
    if(name==='../finance-actions')return {};
    if(name==='./lego-actions')return {};
    if(name==='./pokemon-actions')return {};
    if(name==='../action-form')return {ActionForm:({children}:any)=>React.createElement('form',{},children),ActionButton:({children}:any)=>React.createElement('button',{},children)};
    throw new Error('Unexpected import '+name);
  },exports);if(!reactModule&&!extra)components.set(path,exports);return exports;
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
test('composition and largest changes share one sortable two-column section without changing their content',()=>{
  const View=component('app/finance/finance-view.tsx').default,page=load(renderToStaticMarkup(React.createElement(View,{snapshot:snapshot()}))),group=page('[data-section="composition"]');
  assert.equal(group.length,1);assert.equal(page('[data-section="movers"]').length,0);assert.equal(group.find('.finance-two-columns > .finance-card').length,2);
  assert.match(group.find('.finance-two-columns > .finance-card').eq(0).text(),/Vagyon összetétele/);assert.match(group.find('.finance-two-columns > .finance-card').eq(1).text(),/Mi változott leginkább/);
  assert.equal(group.find('.section-order-controls').length,1);assert.equal(group.find('.finance-pie').length,1);assert.ok(group.find('.finance-movers > div').length>0);
  assert.equal(group.children().first().attr('class'),'local-section-content');assert.equal(group.children().last().attr('class'),'section-order-controls');
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
test('composition SVG title survives server rendering as complete text without mutating balances',()=>{
  const data=snapshot(),before=JSON.stringify(data),Composition=component('app/finance/composition.tsx').default;
  const page=load(renderToStaticMarkup(React.createElement(Composition,{snapshot:data})));
  assert.deepEqual(page('.finance-pie circle title').map((_,element)=>page(element).text()).get(),[`Banks: ${formatMoney(130000)} · 100%`]);
  assert.equal(JSON.stringify(data),before);
});
test('annual and KSH real-growth SVG titles survive server rendering as complete text for every series',()=>{
  const data=snapshot(),Growth=component('app/finance/real-growth.tsx').default;
  data.annual.push({as_of:'2026-09-01',start_date:'2025-09-01',excel_total_minor:110000,nominal:null,inflation:.04,excel_real:null});
  const inflation={annual:[],monthly:[{month:'2026-09',mom:.01,yoy:.06}],fetchedAt:'2026-10-12T00:00:00Z'},before=JSON.stringify(data);
  for(const indices of [null,inflation]){
    const periods=indices?cpiGrowthPeriods(data,indices):realGrowthPeriods(data);
    assert.equal(periods.length,1);
    const page=load(renderToStaticMarkup(React.createElement(Growth,{snapshot:data,inflation:indices})));
    assert.deepEqual(page('.finance-real-chart rect title').map((_,element)=>page(element).text()).get(),periods.flatMap(period=>[
      `${period.label} · Nominális: ${formatPercent(period.nominal)}`,
      `${period.label} · Infláció: ${formatPercent(period.inflation)}`,
      `${period.label} · Reálérték: ${formatPercent(period.real)}`
    ]));
  }
  assert.equal(JSON.stringify(data),before);
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
test('new-month LEGO prefill uses BrickEconomy HUF rather than old balance or inventory cost; zero is distinct from unavailable',()=>{
  const data=snapshot(),Editor=component('app/finance/finance-editor.tsx').default;
  data.accounts.push({id:'cashflow-row-46',name:'LEGO',category:'Collectibles',kind:'asset',sort_order:46,turnover_month:null});data.balances.push({account_id:'cashflow-row-46',amount_minor:10000,turnover:0,source_cell:null});
  for(const hufMinor of [123499,0]){const market={rates:null,collectr:null,rateError:null,collectrError:null,inflation:null,inflationError:null,brickeconomy:{hufMinor,fetchedAt:'2026-10-07T10:30:00Z'}};
    const page=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,market})));
    assert.equal(page('input[name="amount:cashflow-row-46"]').val(),String(Math.floor(hufMinor/100)));assert.equal(page('input[name="currency:cashflow-row-46"]').val(),'HUF');
    assert.equal(page('a[href="https://www.brickeconomy.com/member/wydrian"]').attr('rel'),'noopener noreferrer');assert.match(page.text(),/BrickEconomy.*Current value/);assert.match(page.text(),/2026-10-07 10:30 UTC/);assert.match(page.text(),/nem a bekerülési lista/);assert.equal(page('input[name="confirmed"][required]').length,1);
  }
  const market={rates:null,collectr:null,rateError:null,collectrError:null,inflation:null,inflationError:null,brickeconomy:null,brickeconomyError:'BrickEconomy nem érhető el'};
  const unavailable=load(renderToStaticMarkup(React.createElement(Editor,{accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,market})));
  assert.equal(unavailable('input[name="amount:cashflow-row-46"]').val(),'');assert.match(unavailable('[role="alert"]').text(),/BrickEconomy nem érhető el/);
  assert.doesNotMatch(readFileSync(new URL('../app/finance/finance-editor.tsx',import.meta.url),'utf8'),/legoTotal|lastLegoTotal/);
});
test('LEGO amount events preserve manual input on source failure and existing months; successful explicit refresh replaces new-month input only',()=>{
  // Exercise the actual field's event/render transitions with persistent hook state, without a DOM dependency.
  const states:any[]=[];let cursor=0,changed=false;
  const hooks={useState(initial:unknown){const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],(value:unknown)=>{states[index]=typeof value==='function' ? value(states[index]) : value;changed=true;}];}};
  const Amount=component('app/finance/finance-editor.tsx',hooks,'\nexport {FinanceAmount};').FinanceAmount;
  const account={id:'cashflow-row-46',name:'LEGO',category:'Collection',kind:'asset',sort_order:46,turnover_month:null};
  const market={brickeconomy:{hufMinor:123499,fetchedAt:'2026-10-07T10:30:00Z'}};
  let props:any={account,stored:{amount_minor:9999900},newMonth:true,market,refreshVersion:0};
  function input(tree:any):any {if(!tree || typeof tree!=='object')return;const children=Array.isArray(tree)?tree:[tree];for(const child of children){if(child?.type==='input' && child.props.name==='amount:cashflow-row-46')return child;const found=input(child?.props?.children);if(found)return found;}}
  function render(){let tree:any;for(let i=0;i<5;i++){cursor=0;changed=false;tree=Amount(props);if(!changed)return input(tree).props;}throw new Error('Unstable field state');}
  assert.equal(render().value,'1234');render().onChange({target:{value:'7 777'}});assert.equal(render().value,'7777');
  props={...props,market:{brickeconomy:null},refreshVersion:1};assert.equal(render().value,'7777');
  props={...props,market,refreshVersion:2};assert.equal(render().value,'1234');
  props={...props,market:{brickeconomy:{...market.brickeconomy,hufMinor:0}},refreshVersion:3};assert.equal(render().value,'0');
  states.length=0;props={...props,newMonth:false,market,refreshVersion:0};assert.equal(render().value,'99999');render().onChange({target:{value:'12345'}});
  props={...props,refreshVersion:1};assert.equal(render().value,'12345');
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
   const finance=readFileSync(new URL('../app/finance/page.tsx',import.meta.url),'utf8');assert.match(finance,/FinanceWorkspace snapshot=\{snapshot\} latest=\{latest\}/);assert.doesNotMatch(finance,/LegoInventory/);
});
test('collection cards retain saved values and add independent current HUF valuations, growth, source time and FX provenance',()=>{
  const Growth=component('app/finance/collection-growth.tsx').default,data=snapshot();data.selected!.as_of='2026-09-30';
  data.balances.push({account_id:'cashflow-row-45',amount_minor:20000,turnover:0,source_cell:null},{account_id:'cashflow-row-46',amount_minor:15000,turnover:0,source_cell:null});
  const item={quantity:1,unit_price_minor:10000,acquired_on:'2026-09-03'},inventory={items:[item],quantity:1,totalMinor:10000};
  const market={rates:{date:'2026-10-06',usdHuf:300,eurHuf:350,fetchedAt:'2026-10-07T10:00:00Z'},collectr:{usdMinor:100,fetchedAt:'2026-10-07T10:30:00Z'},brickeconomy:{hufMinor:40000,fetchedAt:'2026-10-07T11:30:00Z'},inflation:{annual:[],monthly:[{month:'2026-10',mom:.1,yoy:.1}],fetchedAt:'2026-10-07T10:00:00Z'},rateError:null,collectrError:null,inflationError:null};
  const before=JSON.stringify(data),page=load(renderToStaticMarkup(React.createElement(Growth,{snapshot:data,lego:inventory,pokemon:inventory,market}))),cards=page('.collection-growth-card');
  assert.equal(cards.length,2);assert.equal(page('[data-valuation="saved"]').length,2);assert.equal(page('[data-valuation="market"]').length,2);
  assert.equal(page('[data-valuation="quality"]').length,0);assert.doesNotMatch(page.text(),/Nyilvántartási adatminőség/);
  assert.match(cards.eq(0).find('[data-valuation="saved"]').text(),/200\s*Ft/);assert.match(cards.eq(0).find('[data-valuation="market"]').text(),/300\s*Ft/);
  assert.match(cards.eq(0).find('[data-valuation="market"]').text(),/\+190\s*Ft/);assert.match(cards.eq(0).find('.collection-growth-delta').text(),/\+100\s*Ft/);
  assert.match(cards.eq(1).find('[data-valuation="market"]').text(),/400\s*Ft/);assert.match(cards.eq(1).find('.collection-growth-delta').text(),/\+250\s*Ft/);
  assert.match(cards.eq(0).text(),/300 Ft\/USD.*2026-10-06/);assert.match(cards.eq(0).text(),/2026-10-07 10:30 UTC/);assert.match(cards.eq(1).text(),/2026-10-07 11:30 UTC/);
  assert.equal(page('a[href="https://app.getcollectr.com/showcase/profile/@wydrian"]').attr('rel'),'noopener noreferrer');assert.equal(page('a[href="https://www.brickeconomy.com/member/wydrian"]').attr('target'),'_blank');
  assert.equal(page('form,input').length,0);assert.equal(JSON.stringify(data),before);assert.match(page.text(),/automatikus havi mentés vagy második vagyonösszeg nélkül/);
});
test('collection market failures do not replace saved growth; valid zero current value displays a loss',()=>{
  const Growth=component('app/finance/collection-growth.tsx').default,data=snapshot();data.selected!.as_of='2026-10-07';data.balances.push({account_id:'cashflow-row-46',amount_minor:20000,turnover:0,source_cell:null});
  const inventory={items:[{quantity:1,unit_price_minor:10000,acquired_on:'2026-10-01'}]},market={rates:null,collectr:{usdMinor:100,fetchedAt:'2026-10-07T10:00:00Z'},brickeconomy:{hufMinor:0,fetchedAt:'2026-10-07T10:00:00Z'},inflation:null};
  const page=load(renderToStaticMarkup(React.createElement(Growth,{snapshot:data,lego:inventory,pokemon:inventory,market}))),cards=page('.collection-growth-card');
  assert.match(cards.eq(0).find('[role="status"]').text(),/árfolyam/);assert.match(cards.eq(1).find('[data-valuation="saved"]').text(),/\+100\s*Ft/);
  assert.match(cards.eq(1).find('[data-valuation="market"]').text(),/-100\s*Ft/);assert.match(cards.eq(1).find('.collection-growth-delta').text(),/-200\s*Ft/);
  const absent=load(renderToStaticMarkup(React.createElement(Growth,{snapshot:data,lego:inventory,pokemon:inventory})));assert.equal(absent('[data-valuation="market"] [role="status"]').length,2);assert.match(absent('[data-valuation="saved"]').text(),/\+100\s*Ft/);
});
test('finance workspace places comparisons above monthly entry and uses latest saved snapshot while viewing history',()=>{
  const Workspace=component('app/finance/finance-workspace.tsx').default,latest=snapshot(),historical=snapshot();historical.selected=historical.previous;
  const inventory={items:[],quantity:0,totalMinor:0},market={rates:null,collectr:null,brickeconomy:null,inflation:null};
  const page=load(renderToStaticMarkup(React.createElement(Workspace,{snapshot:historical,latest,lego:inventory,pokemon:inventory,market})));
  assert.ok(page.html()!.indexOf('id="collection-growth"')<page.html()!.indexOf('id="monthly-entry"'));assert.match(page('#collection-growth .finance-section-head p').text(),/2026\. szeptember/);assert.equal(page('input[name="month"]').val(),'2026-10');
  const noSaved=load(renderToStaticMarkup(React.createElement(Workspace,{snapshot:{...historical,selected:null},latest:{...latest,selected:null},lego:inventory,pokemon:inventory,market})));assert.equal(noSaved('#collection-growth').length,1);assert.equal(noSaved('#monthly-entry').length,0);assert.match(noSaved.text(),/Még nincs mentett havi tény/);
});
test('workspace refresh callback updates current comparison props, not latest saved history',()=>{
  const states:any[]=[];let cursor=0;const hooks={useState(initial:unknown){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],(value:unknown)=>{states[i]=value;}];}};
  const Workspace=component('app/finance/finance-workspace.tsx',hooks).default,data=snapshot(),before=JSON.stringify(data),inventory={items:[]},market={rates:null,collectr:null,brickeconomy:null,inflation:null};
  const props={snapshot:data,latest:data,lego:inventory,pokemon:inventory,market};cursor=0;const initial=Workspace(props),editor=initial.props.children[1].props.children;
  const updated={...market,brickeconomy:{hufMinor:456700,fetchedAt:'2026-10-07T10:00:00Z'}};editor.props.onMarketRefresh(updated);cursor=0;const refreshed=Workspace(props);
  assert.equal(refreshed.props.children[0].props.children.props.market,updated);assert.equal(refreshed.props.children[0].props.children.props.snapshot,data);assert.equal(JSON.stringify(data),before);
});
test('actual editor fetch propagates a successful market refresh but never calls comparison update on HTTP failure',async()=>{
  const states:any[]=[];let cursor=0;const hooks={useState(initial:unknown){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],(value:any)=>{states[i]=typeof value==='function'?value(states[i]):value;}];}};
  const Editor=component('app/finance/finance-editor.tsx',hooks).default,data=snapshot(),updates:any[]=[],updated={rates:null,collectr:null,brickeconomy:{hufMinor:123400,fetchedAt:'2026-10-07T10:00:00Z'},inflation:null};
  const props={accounts:data.accounts,selected:data.selected,balances:data.balances,latest:data.selected,latestBalances:data.balances,onMarketRefresh:(value:unknown)=>updates.push(value)};
  function find(tree:any):any{if(!tree || typeof tree!=='object')return;for(const child of Array.isArray(tree)?tree:[tree]){if(child?.type==='button' && child.props.onClick?.name==='refreshMarket')return child;const found=find(child?.props?.children);if(found)return found;}}
  const original=globalThis.fetch;try{globalThis.fetch=async(input,options)=>{assert.equal(input,'/api/finance/market');assert.equal(options?.cache,'no-store');return Response.json(updated);};cursor=0;await find(Editor(props)).props.onClick();assert.deepEqual(updates,[updated]);
    globalThis.fetch=async()=>new Response('',{status:500});cursor=0;await find(Editor(props)).props.onClick();assert.equal(updates.length,1);
  }finally{globalThis.fetch=original;}
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
