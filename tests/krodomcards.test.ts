import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseKrodomcardsPage, scanKrodomcards, krodomcardsProductUrl } from "../lib/pokemon/adapters/krodomcards.ts";
import { krodomcardsFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { KRODOMCARDS_URL, KRODOMCARDS_FILTER, SHOP_IDS, isShopID, type PokemonProduct } from "../lib/pokemon/types.ts";
import { shop, claimScan, finishScan } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { cancelShopPush } from '../lib/mobile/store.ts';
import { claimPush } from '../lib/mobile/push.ts';
import { readPokemonSnapshot } from "../lib/pokemon/snapshot.ts";

const fixture=readFileSync(new URL('./fixtures/pokemon/krodomcards/catalog.html',import.meta.url),'utf8');
const products=parseKrodomcardsPage(fixture).products;
test('Krodom Cards: notification pseudo-cart links are excluded; IDs, SKU, HUF and legacy CDN read correctly',()=>{
  assert.equal(parseKrodomcardsPage(fixture).cardCount,3);assert.deepEqual(products.map(p=>p.externalID),['2349','2300']);
  assert.deepEqual(products.map(p=>p.availability),['in_stock','preorder']);assert.deepEqual(products.map(p=>p.priceHuf),[1990,19990]);
  assert.equal(products[0].sku,'PKM-2349');assert.equal(products[0].url,'https://www.krodomcards.hu/pokemon-example-booster');
  assert.ok(products[0].image?.startsWith('https://pokedom.cdn.shoprenter.hu/'));
  assert.equal(krodomcardsProductUrl('/pokemon-kanto-power-mini-tin-charizard_'),'https://www.krodomcards.hu/pokemon-kanto-power-mini-tin-charizard_');
  assert.equal(parseKrodomcardsPage(fixture.replace('notify-request ','')).products.length,2);
  const detailsOnly=fixture.replace(/<a class="notify-request button-add-to-cart"[^>]*>Értesítés<\/a>/,'<a class="product-card__details-button" href="/pokemon-30th-celebration-mini-tin">Részletek</a>');
  assert.equal(parseKrodomcardsPage(detailsOnly).products.length,2);
  assert.throws(()=>parseKrodomcardsPage(fixture.replace('class="button-add-to-cart"','class="renamed-cart"')));
});
test('Krodom Cards: active cart is authoritative, disabled cart excluded, invalid optional fields become null',()=>{
  assert.equal(parseKrodomcardsPage(fixture.replace('Utolsó 3 db raktáron','Elfogyott')).products[0].availability,'available');
  assert.equal(parseKrodomcardsPage(fixture.replace('class="button-add-to-cart"','class="button-add-to-cart disabled"')).products.length,1);
  assert.equal(parseKrodomcardsPage(fixture.replaceAll('data-currency="HUF"','data-currency="EUR"')).products[0].priceHuf,null);
  assert.equal(parseKrodomcardsPage(fixture.replace('https://pokedom.cdn.shoprenter.hu/','https://unsafe.example/')).products[0].image,null);
});
test('Krodom Cards: wrong manufacturer/category, pager, button targets/IDs or missing cards fail closed',()=>{
  assert.throws(()=>parseKrodomcardsPage(fixture.replace('value="80" checked','value="81" checked')));
  assert.throws(()=>parseKrodomcardsPage(fixture.replace('value="284"','value="285"')));
  assert.throws(()=>parseKrodomcardsPage(fixture.replace(' checked','')));
  assert.throws(()=>parseKrodomcardsPage(fixture,2));
  assert.throws(()=>parseKrodomcardsPage(fixture.replace('data-product-id="2349"','data-product-id="999"')));
  assert.throws(()=>parseKrodomcardsPage(fixture.replace('checkout%2Fcart','unknown%2Faction')));
  assert.throws(()=>parseKrodomcardsPage(fixture.replace('product_id=2349','product_id=999')));
  assert.throws(()=>parseKrodomcardsPage(fixture.replaceAll('1 - 3 / 3 termék','1 - 4 / 4 termék')));
  for(const url of ['javascript:alert(1)','https://other.example/pokemon','https://u:p@www.krodomcards.hu/pokemon','https://www.krodomcards.hu/index.php?route=checkout/cart'])assert.throws(()=>krodomcardsProductUrl(url));
  for(const url of [KRODOMCARDS_URL.replace('manufacturer|80','manufacturer|81'),KRODOMCARDS_URL+'&route=filter',KRODOMCARDS_URL+'&stockfilter=1',KRODOMCARDS_URL+'&page=51',KRODOMCARDS_URL+'&page=','https://www.krodomcards.hu/index.php?route=checkout/cart','https://www.krodomcards.hu/robots.txt?q=1'])assert.throws(()=>krodomcardsFetchUrl(url));
  assert.equal(isShopID('krodomcards'),true);assert.equal(isShopID('arbitrary-shop'),false);
});
test('Krodom Cards: only filter-list GETs and robots are requested, never cart, waiting list or product URLs',async()=>{
  const requests:string[]=[];
  const scan=await scanKrodomcards(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : fixture;},wait:async()=>{}});
  assert.equal(scan.total,2);assert.equal(scan.pages,1);assert.deepEqual(requests,['https://www.krodomcards.hu/robots.txt',KRODOMCARDS_URL]);
  await assert.rejects(scanKrodomcards(new AbortController().signal,{download:async()=> 'User-agent: *\nDisallow: /index.php',wait:async()=>{}}));
});
test('Krodom Cards: complete unique pagination retains both filters and validates unavailable products too',async()=>{
  const first=fixture.replaceAll('1 - 3 / 3 termék','1 - 3 / 6 termék');
  const second=first.replaceAll('1 - 3 / 6 termék','4 - 6 / 6 termék').replaceAll('2349','3349').replaceAll('2300','3300').replaceAll('2356','3356').replaceAll('manufacturer|80#content','manufacturer|80&amp;page=2#content').replaceAll('>1</a>','>2</a>');
  const requests:string[]=[];
  const options={download:async(url:string)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : new URL(url).searchParams.get('page')==='2' ? second : first;},wait:async()=>{}};
  const scan=await scanKrodomcards(new AbortController().signal,options);assert.equal(scan.pages,2);assert.equal(scan.total,4);
  assert.equal(new URL(requests[2]).searchParams.get('filter'),KRODOMCARDS_FILTER);
  await assert.rejects(scanKrodomcards(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : new URL(url).searchParams.get('page')==='2' ? second.replaceAll('3356','2356') : first}));
  await assert.rejects(scanKrodomcards(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : first}));
  await assert.rejects(scanKrodomcards(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : new URL(url).searchParams.get('page')==='2' ? second.replaceAll('4 - 6 / 6 termék','4 - 6 / 7 termék') : first}));
});
test('Krodom Cards: separate silent baseline, own aggregate event/push and no cancellation of GrandLine push',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const run=(id:'grandline'|'krodomcards',list:PokemonProduct[],now:number)=>{db.prepare('UPDATE pokemon_shops SET next_scan=? WHERE id=?').run(now,id);const owner=claimScan(db,now,id)!;return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
  try{
    const before=SHOP_IDS.filter(id=>!['grandline','krodomcards'].includes(id)).map(id=>shop(db,id));
    registerTestPhone(db);
    assert.equal(run('krodomcards',products,1000).baseline,true);assert.deepEqual(readPokemonSnapshot(db).latestEvents,[]);
    assert.equal(run('krodomcards',products,700_000).events,0);
    const added={...products[0],externalID:'new-item'};run('krodomcards',[...products,added],1400_000);
    run('grandline',products,1000);run('grandline',[...products,added],1400_000);
    const event=readPokemonSnapshot(db,false,5_000_000).latestEvents.find(e=>e.shop_id==='krodomcards');assert.equal(event?.shop_name,'Krodom Cards');
    assert.match(pushForShop(db,'krodomcards').data.title,/^Krodom Cards/);
    cancelShopPush(db,'krodomcards');assert.equal(JSON.parse(claimPush(db,1400_002)!.payload).path,'/pokemon#shop-grandline');
    assert.deepEqual(SHOP_IDS.filter(id=>!['grandline','krodomcards'].includes(id)).map(id=>shop(db,id)),before);
    const preserved=shop(db,'krodomcards');initializeDatabase(db);assert.deepEqual(shop(db,'krodomcards'),preserved);
  }finally{db.close();}
});
