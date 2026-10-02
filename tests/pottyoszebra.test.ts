import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parsePottyoszebraPage, scanPottyoszebra, pottyoszebraProductUrl } from "../lib/pokemon/adapters/pottyoszebra.ts";
import { pottyoszebraFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { POTTYOSZEBRA_URL, SHOP_IDS, type PokemonProduct } from "../lib/pokemon/types.ts";
import { claimScan, finishScan, shop } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';

const fixture=readFileSync(new URL('./fixtures/pokemon/pottyoszebra/available.html',import.meta.url),'utf8');
const products=parsePottyoszebraPage(fixture).products;
test('Pöttyös Zebra: product IDs, SKU, HUF prices and canonical product links, not cart links',()=>{
  assert.deepEqual(products.map(p=>p.externalID),['74572','78493','78499']);
  assert.equal(products[0].sku,'25578');assert.equal(products[0].priceHuf,71990);
  assert.equal(products[0].url,'https://pottyoszebra.hu/pokemon-journey-together-display');
  assert.ok(products[0].image?.startsWith('https://pottyoszebra.cdn.shoprenter.hu/'));
  assert.deepEqual(products.map(p=>p.availability),['in_stock','available','preorder']);
});
test('Pöttyös Zebra: active cart is authoritative, stock labels informational, disabled cart excluded',()=>{
  const result=parsePottyoszebraPage(fixture.replace('class="button-add-to-cart"','class="button-add-to-cart disabled"'));
  assert.equal(result.cardCount,3);assert.equal(result.products.length,2);
  assert.equal(products[1].availability,'available'); // Even the contradictory stock wording does not override an active cart.
  assert.equal(parsePottyoszebraPage(fixture.replaceAll('HUF','EUR')).products[0].priceHuf,null);
});
test('Pöttyös Zebra: invalid filter, incomplete cards, inconsistent totals, IDs and unsafe links fail closed',()=>{
  assert.throws(()=>parsePottyoszebraPage(fixture.replace(' checked="checked"','')));
  assert.throws(()=>parsePottyoszebraPage(fixture.replace('1 - 3 / 3 termék','1 - 3 / 4 termék')));
  assert.throws(()=>parsePottyoszebraPage(fixture.replaceAll('1 - 3 / 3 termék','1 - 4 / 4 termék')));
  assert.throws(()=>parsePottyoszebraPage(fixture.replace('data-product-id="74572"','data-product-id="999"')));
  assert.throws(()=>parsePottyoszebraPage(fixture.replaceAll('button-add-to-cart','changed-cart')));
  assert.throws(()=>parsePottyoszebraPage(fixture,2));
  assert.throws(()=>parsePottyoszebraPage('<html>Access denied</html>'));
  for(const url of ['javascript:alert(1)','https://other.example/pokemon','https://user:pass@pottyoszebra.hu/pokemon','https://pottyoszebra.hu/index.php?route=checkout/cart'])assert.throws(()=>pottyoszebraProductUrl(url));
  for(const url of [POTTYOSZEBRA_URL.replace('stockfilter=1','stockfilter=0'),POTTYOSZEBRA_URL+'&stockfilter=1',POTTYOSZEBRA_URL+'&page=51',POTTYOSZEBRA_URL+'&sort=price',POTTYOSZEBRA_URL+'#content','https://pottyoszebra.hu/index.php'])assert.throws(()=>pottyoszebraFetchUrl(url));
});
test('Pöttyös Zebra: complete pagination retains stockfilter=1 despite storefront pager links omitting it',async()=>{
  const first=fixture.replaceAll('1 - 3 / 3 termék','1 - 3 / 6 termék');
  const second=fixture.replace('pokemon-trading-card-game-tcg">','pokemon-trading-card-game-tcg?page=2">').replaceAll('1 - 3 / 3 termék','4 - 6 / 6 termék').replaceAll('74572','84572').replaceAll('78493','88493').replaceAll('78499','88499');
  const requests:string[]=[];
  const options={download:async(url:string)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('page=2') ? second : first;},wait:async()=>{}};
  const scan=await scanPottyoszebra(new AbortController().signal,options);
  assert.equal(scan.pages,2);assert.equal(scan.total,6);
  assert.deepEqual(requests,['https://pottyoszebra.hu/robots.txt',POTTYOSZEBRA_URL,POTTYOSZEBRA_URL+'&page=2']);
  await assert.rejects(scanPottyoszebra(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : first}));
  await assert.rejects(scanPottyoszebra(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /*page=2*' : url.includes('page=2') ? second : first}));
  await assert.rejects(scanPottyoszebra(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('page=2') ? second.replace(' checked="checked"','') : first}));
  await assert.rejects(scanPottyoszebra(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('page=2') ? second.replaceAll('88493','78493') : first}));
});
test('Pöttyös Zebra: silent independent baseline, unchanged scan silent, new product queues correctly named push',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const run=(list:PokemonProduct[],now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='pottyoszebra'").run(now);const owner=claimScan(db,now,'pottyoszebra')!;return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
  try{
    assert.ok(SHOP_IDS.includes('pottyoszebra'));
    const before=[shop(db),shop(db,'mythgames')];
    registerTestPhone(db);
    assert.equal(run(products,1000).baseline,true);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pokemon_events').get()?.n,0);
    assert.equal(run(products,700_000).events,0);
    assert.equal(run([...products,{...products[0],externalID:'new-id'}],1400_000).events,1);
    const job=pushForShop(db,'pottyoszebra');assert.match(job.data.title,/^Pöttyös Zebra/);assert.equal(job.data.path,'/pokemon#shop-pottyoszebra');
    assert.deepEqual([shop(db),shop(db,'mythgames')],before);
    const preserved=shop(db,'pottyoszebra');initializeDatabase(db);assert.deepEqual(shop(db,'pottyoszebra'),preserved);
  }finally{db.close();}
});
