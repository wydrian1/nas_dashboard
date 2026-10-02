import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseMythgamesCollection, scanMythgames, mythgamesProductUrl } from "../lib/pokemon/adapters/mythgames.ts";
import { MYTHGAMES_URL, type PokemonProduct, type ShopID } from "../lib/pokemon/types.ts";
import { mythgamesFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { shop, claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { cancelShopPush } from '../lib/mobile/store.ts';
import { claimPush } from '../lib/mobile/push.ts';

const fixture=readFileSync(new URL('./fixtures/pokemon/mythgames/available.html',import.meta.url),'utf8');
const products=parseMythgamesCollection(fixture).products;
function run(db:DatabaseSync,shopID:ShopID,list:PokemonProduct[],now:number){
  db.prepare('UPDATE pokemon_shops SET next_scan=? WHERE id=?').run(now,shopID);
  const owner=claimScan(db,now,shopID);assert.ok(owner);
  return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);
}
test('MythGames: list membership is availability, irrespective of cart buttons or badges',()=>{
  assert.equal(products.length,2);
  assert.deepEqual(products.map(product=>product.priceHuf),[4500,39990]);
  assert.deepEqual(products.map(product=>product.availability),['available','preorder']);
  assert.equal(products[0].externalID,'pok-mon-30th-celebration-booster-japan');
  assert.equal(products[0].url,'https://mythgames.eu/products/pok-mon-30th-celebration-booster-japan');
  assert.ok(products[0].image?.startsWith('https://mythgames.eu/cdn/'));
  const changed=parseMythgamesCollection(fixture.replace('KÉSZLETEN','Elfogyott').replace('ELŐRENDELÉS','Hamarosan'));
  assert.equal(changed.products.length,2);
  assert.equal(changed.products[1].availability,'available');
  assert.deepEqual(parseMythgamesCollection(fixture.replace('4.500 Ft','€10')).products.map(product=>product.priceHuf),[null,39990]);
});
test('MythGames: wrong filter, missing count/grid, duplicate products and unsafe links fail closed',()=>{
  assert.throws(()=>parseMythgamesCollection(fixture.replace(' checked','')));
  assert.throws(()=>parseMythgamesCollection(fixture.replace('<span>2</span>','<span>unknown</span>')));
  assert.throws(()=>parseMythgamesCollection(fixture.replaceAll('hdt-collection-products','other-grid')));
  assert.throws(()=>parseMythgamesCollection(fixture.replace('/products/pokemon-example-box','/products/pok-mon-30th-celebration-booster-japan')));
  for(const url of ['javascript:alert(1)','https://other.example/products/a','https://user:pass@mythgames.eu/products/a','https://mythgames.eu/cart/add'])assert.throws(()=>mythgamesProductUrl(url));
  for(const url of [MYTHGAMES_URL+'&sort_by=created-descending',MYTHGAMES_URL+'&filter.v.availability=1',MYTHGAMES_URL+'&page=51',MYTHGAMES_URL.replace('availability=1','availability=0'),'https://mythgames.eu/products/a','https://mythgames.eu/robots.txt?q=1'])assert.throws(()=>mythgamesFetchUrl(url));
});
test('MythGames: only robots and filtered collection pages are requested, never product or variant pages',async()=>{
  const requests:string[]=[];
  const scan=await scanMythgames(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /\nDisallow: /*sort_by*' : fixture;},wait:async()=>{}});
  assert.equal(scan.total,2);assert.equal(scan.pages,1);assert.deepEqual(scan.products,products);
  assert.deepEqual(requests,['https://mythgames.eu/robots.txt',MYTHGAMES_URL]);
});
test('MythGames: pagination requires consistent counts and unique products on every page',async()=>{
  const first=fixture.replace('<span>2</span>','<span>4</span>');
  const second=first.replaceAll('pok-mon-30th-celebration-booster-japan','second-booster').replaceAll('pokemon-example-box','second-box');
  const options={download:async(url:string)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('page=2') ? second : first,wait:async()=>{}};
  const scan=await scanMythgames(new AbortController().signal,options);assert.equal(scan.total,4);assert.equal(scan.pages,2);
  await assert.rejects(scanMythgames(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : first}));
  await assert.rejects(scanMythgames(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('page=2') ? second.replace('<span>4</span>','<span>5</span>') : first}));
  await assert.rejects(scanMythgames(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /' : fixture}));
});
test('shops: independent leases, silent baselines, events, failures and preserved settings',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    run(db,'gamerunner',products,1000);const before=shop(db);
    assert.equal(run(db,'mythgames',products,1000).baseline,true);assert.deepEqual(shop(db),before);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pokemon_events').get()?.n,0);
    const owner=claimScan(db,700_000,'mythgames')!;assert.ok(owner);assert.ok(claimScan(db,700_000,'gamerunner'));
    failScan(db,owner,'HTTP 429',7200_000,700_001);
    assert.equal(shop(db,'mythgames').next_scan,7900_001);assert.equal(shop(db).failure_count,0);
    const preserved=shop(db,'mythgames');initializeDatabase(db);assert.deepEqual(shop(db,'mythgames'),preserved);
    assert.equal(run(db,'mythgames',[...products,{...products[0],externalID:'third-product'}],8000_000).events,1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pokemon_events WHERE shop_id='gamerunner'").get()?.n,0);
  }finally{db.close();}
});
test('shops: settings only cancel that shop push, not sending jobs',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    registerTestPhone(db);
    for(const id of ['gamerunner','mythgames'] as const){run(db,id,products,1000);run(db,id,[...products,{...products[0],externalID:'new-product'}],700_000);}
    const myth=pushForShop(db,'mythgames');assert.match(myth.data.title,/^MythGames/);
    cancelShopPush(db,'gamerunner');
    db.exec("UPDATE pokemon_shops SET enabled=0 WHERE id='gamerunner'");
    const claimed=claimPush(db,700_002);assert.equal(claimed?.id,myth.id);
    cancelShopPush(db,'mythgames');assert.equal(pushForShop(db,'mythgames').state,'sending');
    assert.equal(db.prepare("SELECT mail_state FROM pokemon_events WHERE shop_id='mythgames'").get()?.mail_state,'not_requested');
  }finally{db.close();}
});
test('shops: disabling MythGames cancels its pending push even when GameRunner remains enabled',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    registerTestPhone(db);run(db,'mythgames',products,1000);
    run(db,'mythgames',[...products,{...products[0],externalID:'new-product'}],700_000);
    db.exec("UPDATE pokemon_shops SET enabled=0 WHERE id='mythgames'");cancelShopPush(db,'mythgames');
    assert.equal(claimPush(db,700_002),null);
    assert.equal(pushForShop(db,'mythgames').state,'cancelled');
  }finally{db.close();}
});
