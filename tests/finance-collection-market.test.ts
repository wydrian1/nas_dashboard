import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionGrowth, collectionMarketGrowth } from '../lib/finance/collection-growth-types.ts';
import type { FinanceMarket } from '../lib/finance/market-types.ts';
const items=[{quantity:2,unit_price_minor:10000,acquired_on:'2026-08-07'},{quantity:1,unit_price_minor:5000,acquired_on:null},{quantity:1,unit_price_minor:7000,acquired_on:'2026-10-02'}];
const market:FinanceMarket={rates:{date:'2026-10-06',usdHuf:300.25,eurHuf:350,fetchedAt:'2026-10-07T12:00:00Z'},collectr:{usdMinor:12345,fetchedAt:'2026-10-07T12:00:00Z'},brickeconomy:{hufMinor:35000,fetchedAt:'2026-10-06T23:00:00Z'},rateError:null,collectrError:null,inflation:null,inflationError:null};

test('collection market comparison converts full Collectr cents with current FX and uses each provider UTC date',()=>{
  const before=JSON.stringify({items,market}),pokemon=collectionMarketGrowth(items,'pokemon',market),lego=collectionMarketGrowth(items,'lego',market);
  assert.equal(pokemon.growth?.valueMinor,Math.round(12345*300.25));assert.equal(pokemon.rateDate,'2026-10-06');assert.equal(pokemon.usdHuf,300.25);assert.equal(pokemon.asOf,'2026-10-07');assert.equal(pokemon.growth?.costMinor,32000);
  assert.equal(lego.growth?.valueMinor,35000);assert.equal(lego.asOf,'2026-10-06');assert.equal(lego.rateDate,null);assert.equal(lego.usdHuf,null);assert.equal(JSON.stringify({items,market}),before);
});
test('saved and market growth use independent dates, cost eligibility and one-year assumptions without changing inventory',()=>{
  const saved=collectionGrowth(items,50000,'2026-09-07'),current=collectionMarketGrowth(items,'lego',market).growth!;
  assert.equal(saved.costMinor,25000);assert.equal(saved.futureItems,1);assert.equal(saved.assumedAcquiredOn,'2025-09-07');
  assert.equal(current.costMinor,32000);assert.equal(current.futureItems,0);assert.equal(current.assumedAcquiredOn,'2025-10-06');assert.equal(items[1].acquired_on,null);
});
test('source timestamps are normalized to the actual UTC day, not the timezone-offset calendar day',()=>{
  const result=collectionMarketGrowth(items,'lego',{...market,brickeconomy:{hufMinor:35000,fetchedAt:'2026-10-06T23:30:00-05:00'}});
  assert.equal(result.asOf,'2026-10-07');assert.equal(result.fetchedAt,'2026-10-07T04:30:00.000Z');assert.equal(result.growth?.assumedAcquiredOn,'2025-10-07');
});
test('zero provider values are genuine zero valuations with negative gains, never mistaken for unavailable',()=>{
  const single=[{quantity:1,unit_price_minor:10000,acquired_on:'2026-10-01'}];
  for(const kind of ['pokemon','lego'] as const){const result=collectionMarketGrowth(single,kind,{...market,collectr:{...market.collectr!,usdMinor:0},brickeconomy:{...market.brickeconomy!,hufMinor:0}});assert.equal(result.unavailable,null);assert.equal(result.growth?.valueMinor,0);assert.equal(result.growth?.nominalGainMinor,-10000);assert.equal(result.growth?.realGainMinor,-10000);assert.equal(result.growth?.nominalRatio,-1);}
});
test('source failures and missing FX remain unavailable independently; LEGO HUF does not need rates',()=>{
  for(const kind of ['pokemon','lego'] as const){const result=collectionMarketGrowth(items,kind,{...market,collectr:null,brickeconomy:null});assert.equal(result.growth,null);assert.match(result.unavailable!,/nem helyettesítjük/);}
  assert.equal(collectionMarketGrowth(items,'pokemon',undefined).growth,null);
  const noRates={...market,rates:null},pokemon=collectionMarketGrowth(items,'pokemon',noRates);assert.equal(pokemon.growth,null);assert.match(pokemon.unavailable!,/árfolyam/);assert.equal(pokemon.fetchedAt,new Date(market.collectr!.fetchedAt).toISOString());
  assert.equal(collectionMarketGrowth(items,'lego',noRates).growth?.valueMinor,35000);
});
test('invalid and overflowing market amounts, FX and timestamp never yield a fabricated growth result',()=>{
  for(const hufMinor of [-1,1.5,NaN,Infinity,100_000_000_000_001])assert.equal(collectionMarketGrowth(items,'lego',{...market,brickeconomy:{...market.brickeconomy!,hufMinor}}).growth,null);
  for(const usdMinor of [-1,NaN,1.5,Number.MAX_SAFE_INTEGER])assert.equal(collectionMarketGrowth(items,'pokemon',{...market,collectr:{...market.collectr!,usdMinor}}).growth,null);
  for(const usdHuf of [0,-1,NaN,Infinity,10001])assert.equal(collectionMarketGrowth(items,'pokemon',{...market,rates:{...market.rates!,usdHuf}}).growth,null);
  for(const fetchedAt of ['invalid','2026-02-30T12:00:00Z','2026-10-07'])assert.equal(collectionMarketGrowth(items,'lego',{...market,brickeconomy:{...market.brickeconomy!,fetchedAt}}).growth,null);
});
test('market real growth chains only available CPI, stops at published tail and excludes future purchases',()=>{
  const single=[{quantity:1,unit_price_minor:10000,acquired_on:'2026-08-01'},{quantity:1,unit_price_minor:5000,acquired_on:'2026-11-01'}];
  const inflation={source:'Synthetic',fetchedAt:'2026-10-07T00:00:00Z',annual:[],monthly:[{month:'2026-09',mom:.1,yoy:.1}]};
  const result=collectionMarketGrowth(single,'lego',{...market,inflation}).growth!;
  assert.equal(result.adjustedCostMinor,11000);assert.equal(result.realGainMinor,24000);assert.equal(result.inflationThrough,'2026-09');assert.equal(result.futureItems,1);
  const gap=collectionMarketGrowth([{...single[0],acquired_on:'2026-07-01'}],'lego',{...market,inflation}).growth!;assert.equal(gap.realGainMinor,null);assert.equal(gap.nominalGainMinor,25000);assert.match(gap.realUnavailable!,/Hiányos/);
});
test('empty inventory retains source valuation but never invents nominal or real gains',()=>{
  const result=collectionMarketGrowth([],'lego',market).growth!;assert.equal(result.valueMinor,35000);assert.equal(result.costMinor,0);assert.equal(result.nominalGainMinor,null);assert.equal(result.realGainMinor,null);
});
