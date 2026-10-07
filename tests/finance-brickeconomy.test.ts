import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parseBrickEconomyValue,loadBrickEconomyValue,brickEconomyCurlArgs,brickEconomyCurlBody} from '../lib/finance/brickeconomy.ts';
import {financeMarket} from '../lib/finance/market.ts';
import {BRICKECONOMY_PROFILE,type FinanceMarket} from '../lib/finance/market-types.ts';
import {newMonthAmount,marketRefreshAmount} from '../lib/finance/editor-types.ts';
import {initializeFinance} from '../lib/finance/schema.ts';
import {readFinanceSnapshot} from '../lib/finance/store.ts';

const now=Date.UTC(2026,9,7,12),html=(value='1\u00a0234 Ft',extra='')=>`<h1>wydrian's LEGO Collection</h1><div class="side-box-body"><div class="semibold"><span>Owned Sets</span></div><div class="row rowlist"><div>Owned sets</div><div>2</div></div><div class="row rowlist"><div><span>Current value</span></div><div>${value}</div></div>${extra}</div>`;
const response=(body:string,status=200)=>new Response(body,{status,headers:{'Content-Type':'text/html; charset=utf-8'}});
const account={id:'cashflow-row-46',name:'LEGO',category:'Collection',kind:'asset' as const,sort_order:46,turnover_month:null};
const market:FinanceMarket={rates:null,collectr:null,inflation:null,rateError:null,collectrError:null,inflationError:null,brickeconomy:{hufMinor:123499,fetchedAt:new Date(now).toISOString()}};

test('BrickEconomy reads only the Owned Sets Current value, not product prices, minifigs, wanted sets or SEO estimates',()=>{
  const noise='<meta name="description" content="worth 999999 Ft"><div class="row rowlist"><div>Current value</div><div>99999 Ft</div></div><script>Current value: 1 Ft</script><template>'+html('2 Ft')+'</template><div>Value <b>8888 Ft</b></div>';
  const other='<div class="semibold">Owned Minifigs</div><div class="row rowlist"><div>Current value</div><div>111 Ft</div></div><div class="semibold">Wanted Sets</div><div class="row rowlist"><div>Current value</div><div>222 Ft</div></div>';
  assert.equal(parseBrickEconomyValue(noise+html('1\u00a0234 Ft',other)),123400);
  assert.equal(parseBrickEconomyValue(html('1\u202f234\u202f567 Ft')),123456700);
  assert.equal(parseBrickEconomyValue(html('1234,56 Ft')),123456);
  assert.equal(parseBrickEconomyValue(html('1234.56 Ft')),123456);
  assert.equal(parseBrickEconomyValue(html('0 Ft')),0);
});
test('BrickEconomy rejects wrong profile/currency, missing/private pages, duplicate summaries and malformed/overflow values',()=>{
  for(const value of ['$1,234.00','€1,234.00','1234 USD','1234 HUF','~1234 Ft','-1 Ft','1.2K Ft','1 23 Ft','12,345 Ft','NaN Ft','1e3 Ft','','1000000000001 Ft'])assert.throws(()=>parseBrickEconomyValue(html(value)),value);
  for(const page of [html().replace('wydrian','someone-else'),html().replace('Current value','Forecast value'),html().replace('Owned Sets','Wanted Sets'),'<h1>Sign in</h1>',html()+html(),html('1234 Ft','<div class="row rowlist"><div>Current value</div><div>1234 Ft</div></div>')])assert.throws(()=>parseBrickEconomyValue(page));
});
test('BrickEconomy fetch is fixed HTTPS/HUF, bounded and no-store; no cookies, API keys or local holdings sent',async()=>{
  const fetcher:typeof fetch=async(input,options)=>{assert.equal(String(input),BRICKECONOMY_PROFILE+'?currency=HUF');assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');assert.ok(options?.signal);assert.equal(options?.body,undefined);const headers=new Headers(options?.headers);assert.equal(headers.get('cookie'),null);assert.equal(headers.get('authorization'),null);assert.equal(headers.get('x-apikey'),null);return response(html());};
  assert.deepEqual(await loadBrickEconomyValue(fetcher,now),{hufMinor:123400,fetchedAt:new Date(now).toISOString()});
  for(const status of [301,302,403,429,500])await assert.rejects(loadBrickEconomyValue(async()=>response(html(),status),now));
  for(const page of [html('$1.00'),'<h1>Just a moment...</h1>','x'.repeat(2*1024*1024+1)])await assert.rejects(loadBrickEconomyValue(async()=>response(page),now));
  await assert.rejects(loadBrickEconomyValue(async()=>new Response(html(),{headers:{'Content-Type':'application/json'}}),now));
});
test('Windows HTTPS transport disables curlrc, permits only fixed HTTPS GET, and rejects redirects/content types/oversize bodies',()=>{
  const args=brickEconomyCurlArgs();assert.equal(args[0],'--disable');assert.equal(args[args.indexOf('--url')+1],BRICKECONOMY_PROFILE+'?currency=HUF');assert.equal(args[args.indexOf('--request')+1],'GET');assert.equal(args[args.indexOf('--proto')+1],'=https');assert.equal(args[args.indexOf('--max-time')+1],'12');assert.equal(args[args.indexOf('--max-filesize')+1],String(2*1024*1024));
  for(const forbidden of ['--location','--insecure','--cookie','--cookie-jar','--user','--data','--proxy'])assert.ok(!args.includes(forbidden));
  assert.equal(brickEconomyCurlBody(html()+'\nWYDRIAN_RESPONSE:200:text/html; charset=utf-8'),html());
  for(const value of [html(),html()+'\nWYDRIAN_RESPONSE:302:text/html',html()+'\nWYDRIAN_RESPONSE:403:text/html',html()+'\nWYDRIAN_RESPONSE:200:application/json','x'.repeat(2*1024*1024+1)+'\nWYDRIAN_RESPONSE:200:text/html'])assert.throws(()=>brickEconomyCurlBody(value));
});
test('LEGO prefill and explicit refresh use whole HUF market value; failures preserve manual values and edit mode never replaces history',()=>{
  const old={account_id:account.id,amount_minor:9999900,turnover:0,source_cell:null};
  assert.equal(newMonthAmount(account,old,market),123499);assert.equal(marketRefreshAmount(account,true,'HUF',market),'1234');
  assert.equal(marketRefreshAmount(account,false,'HUF',market),null);assert.equal(marketRefreshAmount(account,true,'USD',market),null);
  assert.equal(newMonthAmount(account,old,{...market,brickeconomy:null}),undefined);assert.equal(marketRefreshAmount(account,true,'HUF',{...market,brickeconomy:null}),null);
  const zero={...market,brickeconomy:{...market.brickeconomy!,hufMinor:0}};assert.equal(newMonthAmount(account,old,zero),0);assert.equal(marketRefreshAmount(account,true,'HUF',zero),'0');
  assert.equal(newMonthAmount({...account,id:'bank'},old,market),undefined);
});
test('BrickEconomy retrieval never writes monthly history or audits; disabled external fetch is a safe visible provider failure',async()=>{
  const db=new DatabaseSync(':memory:');initializeFinance(db);db.exec("INSERT INTO finance_accounts VALUES('cashflow-row-46','LEGO','Collection','asset',46,NULL);INSERT INTO finance_months(month,as_of,source,updated_at) VALUES('2026-09','2026-09-01','manual','2026-09-01');INSERT INTO finance_balances VALUES('2026-09','cashflow-row-46',9999900,0,NULL);");
  try{const before=JSON.stringify(readFinanceSnapshot(db));await loadBrickEconomyValue(async()=>response(html()),now);assert.equal(JSON.stringify(readFinanceSnapshot(db)),before);assert.equal(db.prepare('SELECT count(*) n FROM finance_audit').get()!.n,0);}finally{db.close();}
  const external=process.env.FINANCE_EXTERNAL_FETCH_ENABLED,enabled=process.env.FINANCE_ETORO_ENABLED;
  try{process.env.FINANCE_EXTERNAL_FETCH_ENABLED='false';process.env.FINANCE_ETORO_ENABLED='true';await assert.rejects(loadBrickEconomyValue());const values=await financeMarket();assert.equal(values.brickeconomy,null);assert.match(values.brickeconomyError!,/kézzel|nem helyettesítjük/);assert.equal(values.collectr,null);assert.equal(values.etoro,null);assert.equal(values.rates,null);}
  finally{if(external===undefined)delete process.env.FINANCE_EXTERNAL_FETCH_ENABLED;else process.env.FINANCE_EXTERNAL_FETCH_ENABLED=external;if(enabled===undefined)delete process.env.FINANCE_ETORO_ENABLED;else process.env.FINANCE_ETORO_ENABLED=enabled;}
});
