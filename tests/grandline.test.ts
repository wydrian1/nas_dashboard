import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseGrandlinePage, scanGrandline, grandlineProductUrl } from "../lib/pokemon/adapters/grandline.ts";
import { grandlineFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { robotsPermission } from "../lib/pokemon/robots.ts";
import { GRANDLINE_URL, GRANDLINE_CATALOG_URL, SHOP_IDS, type PokemonProduct } from "../lib/pokemon/types.ts";
import { shop, claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { readPokemonSnapshot } from "../lib/pokemon/snapshot.ts";

const fixture=readFileSync(new URL('./fixtures/pokemon/grandline/catalog.html',import.meta.url),'utf8');
const products=parseGrandlinePage(fixture).products;
const robots='User-agent: *\nAllow: /\nDisallow: /*?stock\nDisallow: /action/\nDisallow: /api/';
test('GrandLine: active cart, stable product IDs, HUF prices and lazy CDN images; details-only products excluded',()=>{
  assert.deepEqual(products.map(p=>p.externalID),['529','115']);assert.deepEqual(products.map(p=>p.availability),['in_stock','preorder']);
  assert.deepEqual(products.map(p=>p.priceHuf),[1590,2090]);assert.equal(products[1].sku,'115/JP');
  assert.equal(products[0].url,'https://www.grandline.hu/pokemon-ninja-spinner-m5-booster-jp-/');
  assert.equal(products[0].image,'https://cdn.myshoptet.com/usr/www.grandline.hu/user/shop/detail/529_booster.webp?x=423');
  assert.equal(parseGrandlinePage(fixture).cardCount,3);
});
test('GrandLine: cart state overrides stock words; disabled carts excluded; optional invalid prices/images become null',()=>{
  assert.equal(parseGrandlinePage(fixture.replace('Raktáron','Elfogyott')).products[0].availability,'available');
  assert.equal(parseGrandlinePage(fixture.replace('class="btn btn-cart add-to-cart-button"','class="btn btn-cart add-to-cart-button disabled"')).products.length,1);
  assert.equal(parseGrandlinePage(fixture.replaceAll('data-micro-price-currency="HUF"','data-micro-price-currency="EUR"')).products[0].priceHuf,null);
  assert.equal(parseGrandlinePage(fixture.replace('https://cdn.myshoptet.com/usr/www.grandline.hu/user/shop/detail/529_booster.webp?x=423','https://unsafe.example/img.webp')).products[0].image,null);
});
test('GrandLine: disallowed stock URL is never requested; only unfiltered category pagination and robots are allowed',async()=>{
  assert.equal(robotsPermission(robots,'/pokemon/?stock=1').allowed,false);
  assert.equal(robotsPermission(robots,'/pokemon/').allowed,true);
  const requests:string[]=[];
  const scan=await scanGrandline(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? robots : fixture;},wait:async()=>{}});
  assert.equal(scan.total,2);assert.equal(scan.pages,1);assert.deepEqual(requests,['https://www.grandline.hu/robots.txt',GRANDLINE_CATALOG_URL]);
  for(const url of [GRANDLINE_URL,GRANDLINE_CATALOG_URL+'?page=2',GRANDLINE_CATALOG_URL+'?x=1&stock=1','https://www.grandline.hu/pokemon/oldal-51/','https://www.grandline.hu/pokemon/oldal-1/','https://www.grandline.hu/action/Cart/addCartItem/','https://grandline.hu/pokemon/'])assert.throws(()=>grandlineFetchUrl(url));
  for(const url of ['javascript:alert(1)','https://other.example/pokemon/','https://u:p@www.grandline.hu/pokemon-test/','https://www.grandline.hu/kosar/'])assert.throws(()=>grandlineProductUrl(url));
});
test('GrandLine: all category cards, including unavailable ones, determine complete unique pagination',async()=>{
  const first=fixture.replace('Oldal <strong>1</strong>/ <strong>1</strong>','Oldal <strong>1</strong>/ <strong>2</strong>').replace('összesen <strong>3</strong>','összesen <strong>6</strong>').replace('</head>','<link rel="next" href="/pokemon/oldal-2/"></head>');
  const second=first.replace('<link rel="canonical" href="https://www.grandline.hu/pokemon/">','').replace('<link rel="next" href="/pokemon/oldal-2/">','<link rel="prev" href="/pokemon/">').replace('Oldal <strong>1</strong>/','Oldal <strong>2</strong>/').replace('aria-current="page">1','aria-current="page">2').replaceAll('529','629').replaceAll('115','215').replaceAll('1393','1493');
  const options={download:async(url:string)=>url.endsWith('/robots.txt') ? robots : url.includes('oldal-2') ? second : first,wait:async()=>{}};
  const scan=await scanGrandline(new AbortController().signal,options);assert.equal(scan.pages,2);assert.equal(scan.total,4);
  await assert.rejects(scanGrandline(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? robots : url.includes('oldal-2') ? second.replaceAll('1493','1393') : first})); // duplicate unavailable product, not just active products
  await assert.rejects(scanGrandline(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? robots : url.includes('oldal-2') ? second.replace('összesen <strong>6</strong>','összesen <strong>7</strong>') : first}));
  await assert.rejects(scanGrandline(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? robots+'\nDisallow: /pokemon/oldal-2/' : url.includes('oldal-2') ? second : first}));
  await assert.rejects(scanGrandline(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? robots : first}));
});
test('GrandLine: wrong category, checked stock filter, changed cart action/ID or incomplete HTML fails closed',()=>{
  assert.throws(()=>parseGrandlinePage(fixture.replace('id-811','id-999')));
  assert.throws(()=>parseGrandlinePage(fixture.replace('name="stock"','name="stock" checked')));
  assert.throws(()=>parseGrandlinePage(fixture.replace('name="productId" type="hidden" value="529"','name="productId" type="hidden" value="999"')));
  assert.throws(()=>parseGrandlinePage(fixture.replace('action="/action/Cart/addCartItem/"','action="https://other.example/cart"')));
  assert.throws(()=>parseGrandlinePage(fixture.replaceAll('btn-cart','changed-cart')));
  assert.throws(()=>parseGrandlinePage(fixture.replace('összesen <strong>3</strong>','összesen <strong>4</strong>')));
});
test('GrandLine: independent silent baseline, event aggregation/push naming, failure preserves state',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const run=(list:PokemonProduct[],now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='grandline'").run(now);const owner=claimScan(db,now,'grandline')!;return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
  try{
    const otherIDs=SHOP_IDS.filter(id=>id!=='grandline'),before=otherIDs.map(id=>shop(db,id));
    registerTestPhone(db);
    assert.equal(run(products,1000).baseline,true);assert.deepEqual(readPokemonSnapshot(db).latestEvents,[]);
    assert.equal(run(products,700_000).events,0);
    const added={...products[0],externalID:'900'};assert.equal(run([...products,added],1400_000).events,1);
    const snapshot=readPokemonSnapshot(db,false,5_000_000);assert.equal(snapshot.latestEvents[0].shop_name,'GrandLine');
    assert.equal(snapshot.shops.find(item=>item.shop.id==='grandline')?.products.length,3);
    assert.match(pushForShop(db,'grandline').data.title,/^GrandLine/);
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='grandline'");const owner=claimScan(db,1400_003,'grandline')!;
    failScan(db,owner,'Incomplete catalog',0,1400_004);assert.equal(shop(db,'grandline').last_count,3);
    assert.equal(readPokemonSnapshot(db,false,5_000_000).latestEvents.length,1);assert.deepEqual(otherIDs.map(id=>shop(db,id)),before);
    const preserved=shop(db,'grandline');initializeDatabase(db);assert.deepEqual(shop(db,'grandline'),preserved);
  }finally{db.close();}
});
