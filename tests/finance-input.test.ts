import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntegerInput, integerMoneyInput, parseIntegerMoney } from '../lib/finance/input-types.ts';
import { financeChartBounds } from '../lib/finance/chart-types.ts';
import { marketRefreshAmount } from '../lib/finance/editor-types.ts';
import { hufFinanceForm } from '../lib/finance/market-types.ts';
import type { FinanceAccount, FinancePoint } from '../lib/finance/types.ts';
import type { FinanceMarket } from '../lib/finance/market-types.ts';

const account=(id:string):FinanceAccount=>({id,name:id,category:'Test',kind:'asset',sort_order:1,turnover_month:null});
const market:FinanceMarket={rates:{date:'2026-10-07',usdHuf:300.123,eurHuf:350,fetchedAt:'2026-10-07T00:00:00Z'},etoro:{usdMinor:123456,fetchedAt:'2026-10-07T00:00:00Z'},collectr:{usdMinor:98765,fetchedAt:'2026-10-07T00:00:00Z'},inflation:null,rateError:null,collectrError:null,inflationError:null};

test('manual amounts remove every space/comma/dot, retain negative debts and reject non-integers',()=>{
  for(const [input,value] of [['1 234 567','1234567'],['1.234,567','1234567'],['1\u00a0234\u202f567','1234567'],['-1,234.567','-1234567'],['0','0'],[' , . ','']]){
    assert.equal(normalizeIntegerInput(input),value);
    assert.equal(parseIntegerMoney(input),value ? Number(value)*100 : null);
  }
  for(const invalid of ['12abc','1e3','--1','1-2','+12','-','1000000000001'])assert.throws(()=>parseIntegerMoney(invalid));
  assert.throws(()=>parseIntegerMoney(null));
  assert.equal(integerMoneyInput(123499),'1234');assert.equal(integerMoneyInput(0),'0');assert.equal(integerMoneyInput(-123401),'-1235');assert.equal(integerMoneyInput(undefined),'');
});
test('chart bounds start at the shown series minimum, include both lines and safely handle flat/negative values',()=>{
  assert.deepEqual(financeChartBounds([{net:9_000_000,assets:10_000_000},{net:9_500_000,assets:10_500_000}]),{low:9_000_000,high:10_500_000,span:1_500_000});
  assert.equal(financeChartBounds([{net:-300,assets:100}]).low,-300);
  for(const points of [[],[{net:0,assets:0}],[{net:120000,assets:120000}],[{net:-10000,assets:-10000}]]){
    const bounds=financeChartBounds(points);assert.ok(bounds.span>0);assert.ok(Number.isFinite(bounds.span));
  }
  const history=Array.from({length:25},(_,i)=>({net:i===0 ? 1 : 100+i,assets:150+i})) as FinancePoint[];
  assert.equal(financeChartBounds(history.slice(-12)).low,113);assert.equal(financeChartBounds(history.slice(-24)).low,101);assert.equal(financeChartBounds(history).low,1);
});
test('explicit new-month provider refresh overwrites USD or HUF, floors provider dollars and preserves values on partial failure',()=>{
  for(const [id,usd] of [['cashflow-row-35',1234],['cashflow-row-45',987]] as const){
    assert.equal(marketRefreshAmount(account(id),true,'USD',market),String(usd));
    assert.equal(marketRefreshAmount(account(id),true,'HUF',market),String(Math.floor(usd*market.rates!.usdHuf)));
    assert.equal(marketRefreshAmount(account(id),false,'USD',market),null);
    assert.equal(marketRefreshAmount(account(id),true,'HUF',{...market,rates:null}),null);
  }
  assert.equal(marketRefreshAmount(account('cashflow-row-35'),true,'USD',{...market,etoro:null}),null);
  assert.equal(marketRefreshAmount(account('cashflow-row-45'),true,'USD',{...market,collectr:{...market.collectr!,usdMinor:0}}),'0');
  for(const id of ['bank','cashflow-row-17','cashflow-row-46'])assert.equal(marketRefreshAmount(account(id),true,'USD',market),null);
});
test('monthly server normalization uses identical integer separator semantics without weakening duplicate guards',()=>{
  const accounts=[account('bank'),account('cashflow-row-35')],form=new FormData();
  form.set('amount:bank','1.234,567');form.set('currency:bank','HUF');form.set('amount:cashflow-row-35','1,234');form.set('currency:cashflow-row-35','USD');
  const result=hufFinanceForm(form,accounts,market.rates);
  assert.equal(result.get('amount:bank'),'1234567');assert.equal(result.get('amount:cashflow-row-35'),'370351.78');
  form.append('amount:bank','1');assert.throws(()=>hufFinanceForm(form,accounts,market.rates));
});
