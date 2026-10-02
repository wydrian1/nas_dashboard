import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseJateknetPage, scanJateknet, jateknetProductUrl } from "../lib/pokemon/adapters/jateknet.ts";
import { parseReflexshopPage, scanReflexshop, reflexshopProductUrl } from "../lib/pokemon/adapters/reflexshop.ts";
import { jateknetFetchUrl, reflexshopFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { JATEKNET_URL, JATEKNET_CATALOG_URL, REFLEXSHOP_URL, SHOP_IDS, type ShopID, type PokemonProduct } from "../lib/pokemon/types.ts";
import { robotsPermission } from "../lib/pokemon/robots.ts";
import { shop, claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { cancelShopPush } from '../lib/mobile/store.ts';
import { claimPush } from '../lib/mobile/push.ts';
import { readPokemonSnapshot } from "../lib/pokemon/snapshot.ts";

const jatek=readFileSync(new URL('./fixtures/pokemon/jateknet/catalog.html',import.meta.url),'utf8');
const reflex=readFileSync(new URL('./fixtures/pokemon/reflexshop/search.html',import.meta.url),'utf8');
const jatekRobots='User-agent: *\nDisallow: /*?f=\nDisallow: /*&f=\nDisallow: /ajax/\nCrawl-delay: 1';
test('JátékNet: locally selects Pokemon names, exact facet count, stable IDs/SKU, price and real lazy CDN image',()=>{
  const result=parseJateknetPage(jatek);assert.equal(result.total,3);assert.equal(result.pokemonTotal,2);
  assert.deepEqual(result.products.map(p=>p.externalID),['297162','270133']);assert.deepEqual(result.products.map(p=>p.priceHuf),[45999,2699]);
  assert.equal(result.products[0].sku,'PCI10447-101');assert.deepEqual(result.products.map(p=>p.availability),['available','preorder']);
  assert.equal(result.products[0].image,'https://netjatek.hu/images/common/products/medium/297162-example.jpg');
  assert.equal(parseJateknetPage(jatek.replace('class="add-to-cart addShoppingCart"','class="add-to-cart addShoppingCart disabled"')).products.length,1);
  assert.equal(parseJateknetPage(jatek.replace('45&nbsp;999&nbsp;Ft','unknown')).products[0].priceHuf,null);
  assert.equal(parseJateknetPage(jatek.replace('https://netjatek.hu/images/common/products/medium/297162-example.jpg','https://unsafe.example/img.jpg')).products[0].image,null);
});
test('JátékNet: wrong category, incomplete/multiple pages, duplicate IDs, incorrect facet, URL or cart fails closed',()=>{
  for(const html of [jatek.replace('Category - Gyűjthető kártya','Other category'),jatek.replace('<span>3</span>','<span>4</span>'),jatek.replace('Pokémon (2)','Pokémon (3)'),jatek.replace('POKÉMON KÁRTYAJÁTÉK','Another card'),jatek.replaceAll('270133','297162'),jatek.replace('name="product_id" value="297162"','name="product_id" value="999"'),jatek.replace('class="add-to-cart addShoppingCart"','class="unknown-cart"'),jatek.replace('href="/pokemon-example-297162"','href="/pokemon-example-999"'),jatek.replace('</ol>','<li><a href="?page=2">2. oldal</a></li></ol>')])assert.throws(()=>parseJateknetPage(html));
  for(const url of [JATEKNET_URL,JATEKNET_CATALOG_URL+'?sort=time',JATEKNET_CATALOG_URL+'?page=2','https://www.jateknet.hu/kosar','https://www.jateknet.hu/robots.txt?x=1'])assert.throws(()=>jateknetFetchUrl(url));
  for(const url of ['javascript:alert(1)','https://other.example/pokemon-297162','https://u:p@www.jateknet.hu/pokemon-297162','/pokemon-999'])assert.throws(()=>jateknetProductUrl(url,'297162'));
});
test('JátékNet: robots-prohibited filter never requested, only robots and unfiltered category GET',async()=>{
  assert.equal(robotsPermission(jatekRobots,new URL(JATEKNET_URL).pathname+new URL(JATEKNET_URL).search).allowed,false);
  const requests:string[]=[],waits:number[]=[];
  const scan=await scanJateknet(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? jatekRobots : jatek;},wait:async(ms)=>{waits.push(ms);}});
  assert.equal(scan.total,2);assert.deepEqual(requests,['https://www.jateknet.hu/robots.txt',JATEKNET_CATALOG_URL]);assert.ok(waits[0]>=1500);
  const blocked:string[]=[];await assert.rejects(scanJateknet(new AbortController().signal,{download:async(url)=>{blocked.push(url);return 'User-agent: *\nDisallow: /gyujtheto-kartya';},wait:async()=>{}}));assert.equal(blocked.length,1);
});
test('Reflexshop: full supplied list includes accessories, SKU IDs, cart action matching, lazy images and HUF price',()=>{
  const result=parseReflexshopPage(reflex);assert.equal(result.total,2);assert.equal(result.products.length,2);
  assert.deepEqual(result.products.map(p=>p.externalID),['PCI10380-101','DS-DM15041']);assert.deepEqual(result.products.map(p=>p.priceHuf),[2190,4490]);
  assert.deepEqual(result.products.map(p=>p.availability),['in_stock','preorder']);assert.ok(result.products[1].title.startsWith('Dragon Shield'));
  assert.equal(result.products[0].image,'https://reflexshop.hu/img/51636/PCI10380-101/210x210/booster.webp');
  assert.equal(parseReflexshopPage(reflex.replace('Raktáron','Elfogyott')).products[0].availability,'available');
  assert.equal(parseReflexshopPage(reflex.replace('class="cart-button"','class="cart-button" aria-disabled="true"')).products.length,1);
  assert.equal(parseReflexshopPage(reflex.replace('2.190 Ft','2.190 EUR')).products[0].priceHuf,null);
  assert.equal(parseReflexshopPage(reflex.replace('https://reflexshop.hu/img/51636/PCI10380-101/210x210/booster.webp','https://unsafe.example/img.webp')).products[0].image,null);
});
test('Reflexshop: missing/incorrect search/filter/count, partial or duplicate list and changed cart fail closed',()=>{
  for(const html of [reflex.replace('pokemon tcg','other search'),reflex.replace('value="in_stock" checked','value="new" checked'),reflex.replace(' checked',''),reflex.replace('base-product-counter">2','base-product-counter">3'),reflex.replaceAll('DS-DM15041','PCI10380-101').replaceAll('DS__unas__DM15041','PCI10380__unas__101'),reflex.replace("cart_add('PCI10380__unas__101'","cart_add('WRONG'"),reflex.replace('class="cart-button"','class="unknown-cart"'),reflex.replace('name="db_artlist_PCI10380__unas__101"','name="wrong"')])assert.throws(()=>parseReflexshopPage(html));
  for(const url of [REFLEXSHOP_URL.replace('pokemon+tcg','pokemon'),REFLEXSHOP_URL.replace('product_status:in_stock','product_status:new'),REFLEXSHOP_URL+'&page=2',REFLEXSHOP_URL+'&search=pokemon+tcg','https://reflexshop.hu/shop_ajax/ajax_cart.php','https://reflexshop.hu/shop_cart.php','https://reflexshop.hu/robots.txt?x=1'])assert.throws(()=>reflexshopFetchUrl(url));
  assert.equal(reflexshopFetchUrl(REFLEXSHOP_URL.replace('pokemon+tcg','pokemon%20tcg')).searchParams.get('search'),'pokemon tcg');
  for(const url of ['javascript:void(0)','https://other.example/item','https://u:p@reflexshop.hu/item','https://reflexshop.hu/shop_cart.php'])assert.throws(()=>reflexshopProductUrl(url));
});
test('Reflexshop: only robots and exact supplied search GET, never executing JS or fetching AJAX/cart/products',async()=>{
  const requests:string[]=[];
  const scan=await scanReflexshop(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /shop_ajax/*' : reflex;},wait:async()=>{}});
  assert.equal(scan.total,2);assert.equal(scan.pages,1);assert.deepEqual(requests,['https://reflexshop.hu/robots.txt',REFLEXSHOP_URL]);
  const blocked:string[]=[];await assert.rejects(scanReflexshop(new AbortController().signal,{download:async(url)=>{blocked.push(url);return 'User-agent: *\nDisallow: /shop_search.php';},wait:async()=>{}}));assert.equal(blocked.length,1);
});
for(const [id,name,products] of [['jateknet','JátékNet',parseJateknetPage(jatek).products],['reflexshop','Reflexshop',parseReflexshopPage(reflex).products]] as const){
  test(`${name}: independent silent baseline and aggregate events/push, failed scan preserves state and old shop settings`,()=>{
    const db=new DatabaseSync(':memory:');initializeDatabase(db);
    const run=(shopID:ShopID,list:PokemonProduct[],now:number)=>{db.prepare('UPDATE pokemon_shops SET next_scan=? WHERE id=?').run(now,shopID);const owner=claimScan(db,now,shopID)!;return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
    try{
      const otherIDs=SHOP_IDS.filter(other=>other!==id && other!=='gamerunner'),before=otherIDs.map(other=>shop(db,other));
      registerTestPhone(db);
      assert.equal(run(id,products,1000).baseline,true);assert.deepEqual(readPokemonSnapshot(db).latestEvents,[]);assert.equal(run(id,products,700_000).events,0);
      const added={...products[0],externalID:'NEW'};assert.equal(run(id,[...products,added],1400_000).events,1);
      const snapshot=readPokemonSnapshot(db,false,5_000_000);assert.equal(snapshot.latestEvents[0].shop_name,name);assert.equal(snapshot.shops.find(item=>item.shop.id===id)?.products.length,3);
      assert.ok(pushForShop(db,id).data.title.startsWith(name));
      db.prepare('UPDATE pokemon_shops SET next_scan=0 WHERE id=?').run(id);const owner=claimScan(db,1400_003,id)!;failScan(db,owner,'Incomplete list',0,1400_004);assert.equal(shop(db,id).last_count,3);
      run('gamerunner',products,1000);run('gamerunner',[...products,added],1400_000);
      cancelShopPush(db,id);assert.equal(JSON.parse(claimPush(db,1400_002)!.payload).path,'/pokemon#shop-gamerunner');
      assert.deepEqual(otherIDs.map(other=>shop(db,other)),before);
      const preserved=shop(db,id);initializeDatabase(db);assert.deepEqual(shop(db,id),preserved);
    }finally{db.close();}
  });
}
