import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync,spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { ETORO_BALANCE_URL,EtoroError,loadEtoroValue,parseEtoroBalance,parseEtoroCredentials } from '../lib/finance/etoro.ts';
import { ETORO_ACCOUNT_ID,type FinanceMarket } from '../lib/finance/market-types.ts';
import { newMonthAmount,marketRefreshAmount } from '../lib/finance/editor-types.ts';
import { initializeFinance } from '../lib/finance/schema.ts';
import { readFinanceSnapshot } from '../lib/finance/store.ts';
const now=Date.UTC(2026,9,3),credentials={apiKey:'test-api-key-value-1234',userKey:'test-user-key-value-5678'};
const balances=(total=123.45)=>({totalBalance:total,displayCurrency:'USD',balances:[{accountId:'trading-test',accountType:'Trading',displayBalance:total-20,displayCurrency:'USD'},{accountId:'cash-test',accountType:'Cash',displayBalance:20,displayCurrency:'USD'}]});
const account=(id:string)=>({id,name:id,category:'Test',kind:'asset' as const,sort_order:1,turnover_month:null});
const market:FinanceMarket={rates:null,collectr:null,inflation:null,rateError:null,collectrError:null,inflationError:null,etoro:{usdMinor:12345,fetchedAt:new Date(now).toISOString()}};
test('eToro parser returns only USD Total Balance, combining all account types, never available cash/stock-only',()=>{
  assert.deepEqual(parseEtoroBalance(balances(),now),{usdMinor:12345,fetchedAt:new Date(now).toISOString()});
  const data=balances();data.balances[0].accountType='Crypto';assert.equal(parseEtoroBalance({...data,secret:'never return',gcid:9},now).usdMinor,12345);
  assert.equal(parseEtoroBalance({totalBalance:0,displayCurrency:'USD',balances:[{accountId:'zero',accountType:'Trading',displayCurrency:'USD',displayBalance:0}]},now).usdMinor,0);
  for(const change of [{displayCurrency:'HUF'},{totalBalance:-1},{totalBalance:Infinity},{totalBalance:'123.45'},{totalBalance:1e15},{balances:[]},{balances:null},{totalBalance:999}])assert.throws(()=>parseEtoroBalance({...balances(),...change},now),EtoroError);
  for(const change of [{displayCurrency:'EUR'},{displayBalance:NaN},{accountId:''},{displayBalance:null}]){const data=balances();Object.assign(data.balances[0],change);assert.throws(()=>parseEtoroBalance(data,now),EtoroError);}
  const duplicate=balances();duplicate.balances[1].accountId=duplicate.balances[0].accountId;assert.throws(()=>parseEtoroBalance(duplicate,now));
  for(const data of [null,[],{totalBalance:1},{}])assert.throws(()=>parseEtoroBalance(data,now));
});
test('eToro credential validation rejects injected headers, URLs, extra fields and oversized files without disclosing them',()=>{
  assert.deepEqual(parseEtoroCredentials(JSON.stringify(credentials)),credentials);
  for(const value of [{...credentials,userKey:'secret\r\nx-injected: yes'},{...credentials,apiKey:'https://evil.example'},{...credentials,extra:'bad'},{apiKey:'only'},null,[],{}])assert.throws(()=>parseEtoroCredentials(JSON.stringify(value)),EtoroError);
  for(const value of ['not-json','x'.repeat(17000)])assert.throws(()=>parseEtoroCredentials(value),(error:unknown)=>error instanceof EtoroError&&!error.message.includes(value));
});
test('eToro loader uses only GET on fixed official all-balances URL, UUID, no redirects and no client-provided credentials/URL',async()=>{
  let requests=0;
  const fetcher:typeof fetch=async(input,options)=>{
    requests++;assert.equal(String(input),ETORO_BALANCE_URL);const url=new URL(String(input));assert.equal(url.searchParams.has('accountTypes'),false);assert.equal(url.searchParams.get('includeSubAccounts'),'true');
    assert.equal(options?.method,'GET');assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');assert.ok(options?.signal);
    const h=new Headers(options?.headers);assert.equal(h.get('x-api-key'),credentials.apiKey);assert.equal(h.get('x-user-key'),credentials.userKey);assert.match(h.get('x-request-id')!,/^[0-9a-f-]{36}$/);assert.equal(h.get('cookie'),null);assert.equal(h.get('authorization'),null);
    return Response.json(balances());
  };
  const value=await loadEtoroValue({fetcher,credentials,now});assert.equal(requests,1);assert.equal(value.usdMinor,12345);assert.deepEqual(Object.keys(value).sort(),['fetchedAt','usdMinor']);
  for(const status of [401,403,429,500])await assert.rejects(loadEtoroValue({credentials,now,fetcher:async()=>new Response('secret upstream body',{status})}),(error:unknown)=>error instanceof EtoroError&&!error.message.includes('secret'));
  for(const response of [new Response('secret-invalid-json'),new Response('x'.repeat(1024*1024+1)),Response.json({totalBalance:0})])await assert.rejects(loadEtoroValue({credentials,now,fetcher:async()=>response}),EtoroError);
  await assert.rejects(loadEtoroValue({credentials,now,fetcher:async()=>{throw new Error(credentials.userKey);}}),(error:unknown)=>error instanceof EtoroError&&!error.message.includes(credentials.userKey));
});
test('eToro new-month prefill affects exactly stock row; preserves manual/HUF/historical fields and never falls back to old HUF',()=>{
  const etoro=account(ETORO_ACCOUNT_ID),old={account_id:etoro.id,amount_minor:9999900,turnover:0,source_cell:null};
  assert.equal(newMonthAmount(etoro,old,market,undefined),12345);
  for(const id of ['cashflow-row-19','cashflow-row-17','lightyear','revolut','bank'])assert.equal(newMonthAmount(account(id),old,market,undefined),undefined);
  assert.equal(newMonthAmount(etoro,old,{...market,etoro:null},undefined),undefined);
  assert.equal(newMonthAmount(etoro,old,{...market,etoro:{usdMinor:0,fetchedAt:market.etoro!.fetchedAt}},undefined),0);
  assert.equal(marketRefreshAmount(etoro,true,false,'USD',market),'123.45');
  for(const [newMonth,dirty,currency]of [[false,false,'USD'],[true,true,'USD'],[true,false,'HUF']] as const)assert.equal(marketRefreshAmount(etoro,newMonth,dirty,currency,market),null);
  assert.equal(marketRefreshAmount(account('cashflow-row-19'),true,false,'USD',market),null);
  assert.equal(marketRefreshAmount(etoro,true,false,'USD',{...market,etoro:null}),'');
});
test('read-only eToro fetch does not write monthly history, audit or source archive',async()=>{
  const db=new DatabaseSync(':memory:');initializeFinance(db);db.exec("INSERT INTO finance_accounts VALUES('cashflow-row-35','eToro (stock)','Stock','asset',35,NULL);INSERT INTO finance_months(month,as_of,source,updated_at) VALUES('2026-09','2026-09-01','excel','2026-09-01');INSERT INTO finance_balances VALUES('2026-09','cashflow-row-35',9999900,0,NULL);");
  try{const before=JSON.stringify(readFinanceSnapshot(db));await loadEtoroValue({credentials,now,fetcher:async()=>Response.json(balances())});assert.equal(JSON.stringify(readFinanceSnapshot(db)),before);assert.equal(db.prepare('SELECT count(*) n FROM finance_audit').get()!.n,0);}finally{db.close();}
});
test('eToro credentials setup normalizes owner format, never prints keys and never overwrites an existing credential file',()=>{
  const root=mkdtempSync(join(tmpdir(),'nas-etoro-test-')),input=join(root,'input.txt'),script=new URL('../scripts/Configure-Etoro.mjs',import.meta.url);
  writeFileSync(input,credentials.userKey+'\n\nPublic :\n\n'+credentials.apiKey);
  const result=execFileSync(process.execPath,[fileURLToPath(script),input],{cwd:root,encoding:'utf8'});
  assert.ok(!result.includes(credentials.userKey)&&!result.includes(credentials.apiKey));assert.deepEqual(JSON.parse(readFileSync(join(root,'.runtime/secrets/etoro.json'),'utf8')),credentials);
  const again=spawnSync(process.execPath,[fileURLToPath(script),input],{cwd:root,encoding:'utf8'});assert.equal(again.status,1);assert.ok(!again.stderr.includes(credentials.userKey));
});
test('eToro production loader caches success for one minute, respects disable/offline flags and never reuses stale data after failure',async()=>{
  const root=mkdtempSync(join(tmpdir(),'nas-etoro-cache-')),cwd=process.cwd(),originalFetch=globalThis.fetch,enabled=process.env.FINANCE_ETORO_ENABLED,external=process.env.FINANCE_EXTERNAL_FETCH_ENABLED;
  mkdirSync(join(root,'.runtime/secrets'),{recursive:true});writeFileSync(join(root,'.runtime/secrets/etoro.json'),JSON.stringify(credentials));
  let requests=0,fail=false;
  try{
    process.chdir(root);process.env.FINANCE_ETORO_ENABLED='true';delete process.env.FINANCE_EXTERNAL_FETCH_ENABLED;
    globalThis.fetch=async()=>{requests++;return fail?new Response(credentials.userKey,{status:403}):Response.json(balances());};
    const [first,second]=await Promise.all([loadEtoroValue({now}),loadEtoroValue({now})]);assert.deepEqual(first,second);assert.equal(requests,1);
    await loadEtoroValue({now:now+59999});assert.equal(requests,1);
    process.env.FINANCE_ETORO_ENABLED='false';await assert.rejects(loadEtoroValue({now}),EtoroError);assert.equal(requests,1);
    process.env.FINANCE_ETORO_ENABLED='true';process.env.FINANCE_EXTERNAL_FETCH_ENABLED='false';await assert.rejects(loadEtoroValue({now}),EtoroError);assert.equal(requests,1);
    delete process.env.FINANCE_EXTERNAL_FETCH_ENABLED;fail=true;await assert.rejects(loadEtoroValue({now:now+60001}),EtoroError);assert.equal(requests,2);
    fail=false;assert.equal((await loadEtoroValue({now:now+60002})).usdMinor,12345);assert.equal(requests,3);
  }finally{process.chdir(cwd);globalThis.fetch=originalFetch;if(enabled===undefined)delete process.env.FINANCE_ETORO_ENABLED;else process.env.FINANCE_ETORO_ENABLED=enabled;if(external===undefined)delete process.env.FINANCE_EXTERNAL_FETCH_ENABLED;else process.env.FINANCE_EXTERNAL_FETCH_ENABLED=external;}
});
