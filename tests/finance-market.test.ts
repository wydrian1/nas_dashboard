import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parseCollectrValue, parseRate, loadExchangeRates, loadCollectrValue } from '../lib/finance/market.ts';
import { parseKshInflation, loadInflation } from '../lib/finance/inflation.ts';
import { boundedText } from '../lib/finance/download.ts';
import { hufFinanceForm, usdToHuf, validRateDate, cpiGrowthPeriods } from '../lib/finance/market-types.ts';
import { initializeFinance } from '../lib/finance/schema.ts';
import { readFinanceSnapshot, saveFinanceMonth } from '../lib/finance/store.ts';
const now=Date.UTC(2026,9,2,12),rates={date:'2026-10-02',usdHuf:300.123,eurHuf:350.12,fetchedAt:'2026-10-02T12:00:00Z'};
const mockFetch=(handler:(url:string)=>Response)=>((input:unknown)=>Promise.resolve(handler(String(input)))) as typeof fetch;

test('Collectr parser skips skeletons and product prices; rejects missing, ambiguous, compact or non-dollar values',()=>{
  assert.equal(parseCollectrValue('<h3>Estimated Portfolio Value</h3><div data-testid="skeleton"></div><h3>Estimated Portfolio Value</h3><h3>$1,234.56</h3><h3>Product price</h3><span>$999.00</span>'),123456);
  assert.equal(parseCollectrValue('<h3>Estimated Portfolio Value</h3><h3>$0.00</h3>'),0);
  for(const html of ['<h3>Estimated Portfolio Value</h3><div></div>','<h3>Estimated Portfolio Value</h3><h3>€1,234.56</h3>','<h3>Estimated Portfolio Value</h3><h3>$1.2K</h3>','<h3>Estimated Portfolio Value</h3><h3>$1.00</h3><h3>Estimated Portfolio Value</h3><h3>$2.00</h3>'])assert.throws(()=>parseCollectrValue(html));
});
test('Frankfurter validates the actual pair, publish date, finite rates and bound; weekend/date has no silent fallback',()=>{
  assert.deepEqual(parseRate({date:'2026-10-02',base:'USD',quote:'HUF',rate:300.12},'USD',undefined,now),{date:'2026-10-02',rate:300.12});
  assert.throws(()=>parseRate({date:'2026-09-04',base:'USD',quote:'HUF',rate:300},'USD','2026-09-06',now));
  for(const change of [{base:'EUR'},{quote:'EUR'},{rate:Infinity},{rate:0},{rate:50000},{date:'2026-10-03'},{date:'2026-09-01'}])assert.throws(()=>parseRate({date:'2026-10-02',base:'USD',quote:'HUF',rate:300,...change},'USD',undefined,now));
  assert.throws(()=>validRateDate('2026-09-20',now));
});
test('market downloads are fixed-host, bounded, reject redirects/errors and never need account credentials',async()=>{
  const urls:string[]=[],fetcher=mockFetch(url=>{urls.push(url);return Response.json({date:'2026-10-02',base:url.includes('/usd/') ? 'USD' : 'EUR',quote:'HUF',rate:300});});
  assert.equal((await loadExchangeRates(undefined,fetcher,now)).usdHuf,300);assert.ok(urls.every(url=>url.startsWith('https://api.frankfurter.dev/v2/rate/')));
  assert.equal((await loadCollectrValue(mockFetch(()=>new Response('<h3>Estimated Portfolio Value</h3><h3>$12.34</h3>')),now)).usdMinor,1234);
  await assert.rejects(()=>loadCollectrValue(mockFetch(()=>new Response('',{status:403})),now));
  await assert.rejects(()=>boundedText(new Response('x'.repeat(100)),10));
});
test('USD form conversion is server-priced, stores only Ft balances/audit and never reinterprets existing HUF',()=>{
  const db=new DatabaseSync(':memory:');initializeFinance(db);db.exec("INSERT INTO finance_accounts VALUES('cashflow-row-17','Ledger','Crypto','asset',17,NULL),('cashflow-row-35','eToro','Stock','asset',35,NULL),('cashflow-row-45','PokeMon','Collection','asset',45,NULL);");
  try{
    const accounts=readFinanceSnapshot(db).accounts,data=new FormData();data.set('month','2026-10');data.set('as_of','2026-10-02');data.set('revision','0');data.set('note','');data.set('confirmed','on');data.set('fx_date','2026-10-02');
    for(const account of accounts){data.set('amount:'+account.id,'12');data.set('currency:'+account.id,'USD');}
    data.set('currency:cashflow-row-35','HUF');data.set('amount:cashflow-row-35','999');data.set('usdHuf','1');
    const normalized=hufFinanceForm(data,accounts,rates);assert.equal(normalized.has('fx_date'),false);assert.equal(normalized.has('currency:cashflow-row-17'),false);
    saveFinanceMonth(db,normalized,'admin',rates.fetchedAt,{date:rates.date,usdHuf:rates.usdHuf});
    const balances=readFinanceSnapshot(db).balances;assert.equal(balances.find(b=>b.account_id==='cashflow-row-17')!.amount_minor,360148);assert.equal(balances.find(b=>b.account_id==='cashflow-row-35')!.amount_minor,99900);
    const audit=JSON.parse(String(db.prepare('SELECT after_json FROM finance_audit').get()!.after_json));assert.equal(audit.conversion.usdHuf,300.123);assert.ok(audit.balances.every((b:any)=>Object.keys(b).every(key=>!key.toLowerCase().includes('usd'))));
    assert.throws(()=>hufFinanceForm(data,accounts,null));data.set('amount:cashflow-row-17','');assert.throws(()=>hufFinanceForm(data,accounts,rates));
  }finally{db.close();}
});
test('USD converter rejects negative/overflow amounts and forged or duplicate currency selection',()=>{
  assert.equal(usdToHuf(100,300),30000);assert.throws(()=>usdToHuf(-100,300));assert.throws(()=>usdToHuf(100000000000000,300));
  const account={id:'bank',name:'Bank',category:'Bank',kind:'asset' as const,sort_order:1,turnover_month:null},data=new FormData();data.set('amount:bank','100');data.set('currency:bank','USD');assert.throws(()=>hufFinanceForm(data,[account],rates));
  data.set('currency:bank','HUF');data.append('currency:bank','HUF');assert.throws(()=>hufFinanceForm(data,[account],rates));
});
function kshFixture(){
  const head='<thead><tr>'+['Időszak','Étel','Ital','Ruha','Tartós','Energia','Egyéb','Szolgáltatás','Összesen','Nyugdíjas'].map(title=>'<th>'+title+'</th>').join('')+'</tr></thead>';
  const row=(year:string,month:string,index:string)=>`<tr><th>${year}</th>${month ? '<th>'+month+'</th>' : ''}${Array.from({length:9},(_,i)=>'<td>'+(i===7 ? index : '100,0')+'</td>').join('')}</tr>`;
  const section=(label:string,index:string)=>`<tbody><tr class="franciacim"><th>${label}</th></tr>${row('2026.','augusztus',index)}${row('','szeptember','')}</tbody>`;
  return {annual:`<table class="stadat">${head}<tbody>${row('2025','','104,4')}${row('2026','','999,9')}</tbody></table>`,monthly:`<table class="stadat">${head}${section('Az előző év azonos időszaka = 100,0%','101,3')}${section('Előző hónap = 100,0%','100,2')}${section('Évkezdettől kumulált, előző év azonos időszaka = 100,0%','199,9')}</table>`};
}
test('KSH parser distinguishes monthly YoY/MoM, total CPI vs category, annual averages and missing/cumulative data',()=>{
  const fixture=kshFixture(),series=parseKshInflation(fixture.annual,fixture.monthly,now);
  assert.equal(series.annual.length,1);assert.ok(Math.abs(series.annual[0].rate-.044)<1e-10);assert.equal(series.monthly.length,1);
  assert.equal(series.monthly[0].month,'2026-08');assert.ok(Math.abs(series.monthly[0].yoy-.013)<1e-10);assert.ok(Math.abs(series.monthly[0].mom!-.002)<1e-10);
  assert.throws(()=>parseKshInflation(fixture.annual,fixture.monthly.replace('Összesen','Wrong'),now));
});
test('KSH revaluation uses matched observation months, not annual-average inflation, and never fills a missing month',()=>{
  const db=new DatabaseSync(':memory:');initializeFinance(db);db.exec("INSERT INTO finance_accounts VALUES('bank','Bank','Bank','asset',1,NULL);");
  for(const [month,amount] of [['2025-08',10000],['2026-08',12000],['2026-09',13000]] as const){db.prepare("INSERT INTO finance_months(month,as_of,source,updated_at) VALUES(?,?,'manual',?)").run(month,month+'-02',month+'-02');db.prepare('INSERT INTO finance_balances VALUES(?,?,?,0,NULL)').run(month,'bank',amount);}
  try{
    const fixture=kshFixture(),inflation=parseKshInflation(fixture.annual,fixture.monthly,now),periods=cpiGrowthPeriods(readFinanceSnapshot(db),inflation);
    assert.equal(periods.length,1);assert.equal(periods[0].label,'2026-08');assert.ok(Math.abs(periods[0].real-(1.2/1.013-1))<1e-10);
    assert.equal(cpiGrowthPeriods(readFinanceSnapshot(db,'2025-08'),inflation).length,0);
  }finally{db.close();}
});
