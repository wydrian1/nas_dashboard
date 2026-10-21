import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseTcgfutarPage, scanTcgfutar } from "../lib/pokemon/adapters/tcgfutar.ts";
import { parseSportkartyaboltPage, scanSportkartyabolt } from "../lib/pokemon/adapters/sportkartyabolt.ts";
import { parseRtcollectorsclubPage, scanRtcollectorsclub, rtcollectorsclubProductUrl } from "../lib/pokemon/adapters/rtcollectorsclub.ts";
import { parseCardversePage, scanCardverse, cardverseProductUrl } from "../lib/pokemon/adapters/cardverse.ts";
import { unasCategoryProductUrl } from "../lib/pokemon/adapters/unas-category.ts";
import { tcgfutarFetchUrl, sportkartyaboltFetchUrl, rtcollectorsclubFetchUrl, cardverseFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { TCGFUTAR_CATALOG_URL, SPORTKARTYABOLT_URL, RTCOLLECTORSCLUB_URL, RTCOLLECTORSCLUB_CATALOG_URL, CARDVERSE_URL, SHOP_IDS, type PokemonProduct } from "../lib/pokemon/types.ts";
import { shop, claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { cancelShopPush } from '../lib/mobile/store.ts';
import { claimPush } from '../lib/mobile/push.ts';
import { readPokemonSnapshot } from "../lib/pokemon/snapshot.ts";
import { robotsPermission } from "../lib/pokemon/robots.ts";

const fixture=(id:string)=>readFileSync(new URL(`./fixtures/pokemon/${id}/catalog.html`,import.meta.url),'utf8');
const tcg=fixture('tcgfutar'),sport=fixture('sportkartyabolt'),rt=fixture('rtcollectorsclub'),cv=fixture('cardverse');
test('TCG Futár: only active cart, unavailable cards still counted, opaque SKU, both slug and spd links, real lazy image',()=>{
  const p=parseTcgfutarPage(tcg);assert.equal(p.total,2);assert.equal(p.cardIDs.length,2);assert.equal(p.products.length,1);
  assert.equal(p.products[0].externalID,'743994');assert.equal(p.products[0].priceHuf,15000);assert.equal(p.products[0].availability,'in_stock');assert.equal(p.products[0].image,'https://tcgfutar.hu/img/17648/743994/deck.webp');
  assert.equal(parseTcgfutarPage(tcg.replace('Raktáron (1 db)','Nincs raktáron')).products.length,1);
  assert.equal(parseTcgfutarPage(tcg.replace('class="product__main-btn product__cart-btn"','class="product__main-btn product__cart-btn" disabled')).products.length,0);
  assert.throws(()=>parseTcgfutarPage(tcg.replace('class="product__main-btn product__cart-btn"','class="renamed-cart"')));
  assert.throws(()=>parseTcgfutarPage(tcg.replace("cart_add('743994'","cart_add('wrong'")));
  assert.throws(()=>parseTcgfutarPage(tcg.replace('class="not-stock__text"','class="unknown-status"')));
});
test('TCG Futár: full cumulative scan starts at one, never appends duplicate prefixes, stops before supplied page four',async()=>{
  const first=tcg.replace(/<article class="product" id="page_artlist_artlist_PCI10380__unas__101"[\s\S]*?<\/article>/,'').replace('</body>','<script>var infinite_scroll_num=1;</script></body>');
  const requests:string[]=[];
  const options={download:async(url:string)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /shop_ajax/*' : url.includes('infinite_page=2') ? tcg : first;},wait:async()=>{}};
  const scan=await scanTcgfutar(new AbortController().signal,options);assert.equal(scan.total,1);assert.equal(scan.pages,2);assert.deepEqual(requests,['https://tcgfutar.hu/robots.txt',TCGFUTAR_CATALOG_URL,TCGFUTAR_CATALOG_URL+'?infinite_page=2']);
  await assert.rejects(scanTcgfutar(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('infinite_page=2') ? first.replace('infinite_scroll_num=1','infinite_scroll_num=2') : first}));
  await assert.rejects(scanTcgfutar(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : url.includes('infinite_page=2') ? tcg.replaceAll('743994','999999') : first}));
  await assert.rejects(scanTcgfutar(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /*infinite_page=2' : first}));
  assert.throws(()=>parseTcgfutarPage(first,2));
});
test('Sport Kártya Bolt: SKU identities distinguish pack/display, sale rather than unit/original price, active preorder',()=>{
  const p=parseSportkartyaboltPage(sport);assert.deepEqual(p.products.map(p=>p.externalID),['60114','60114-1']);assert.deepEqual(p.products.map(p=>p.priceHuf),[2190,69990]);assert.deepEqual(p.products.map(p=>p.availability),['in_stock','preorder']);
  assert.equal(parseSportkartyaboltPage(sport.replace('2 190 Ft','unknown')).products[0].priceHuf,null);
  assert.equal(parseSportkartyaboltPage(sport.replace('https://sportkartyabolt.hu/img/8974/60114/booster.webp','https://unsafe.example/img.webp')).products[0].image,null);
  assert.throws(()=>parseSportkartyaboltPage(sport.replace('product-num__end">2','product-num__end">1')));
  assert.throws(()=>parseSportkartyaboltPage(sport.replace('https://sportkartyabolt.hu/Pokemon-Kartya','https://sportkartyabolt.hu/Other')));
  assert.throws(()=>parseSportkartyaboltPage(sport.replaceAll('60114-1','60114').replaceAll('60114__unas__1','60114')));
});
test('Sport Kártya Bolt: robots without User-agent is a valid rule-free file, HTML/error body never accepted',async()=>{
  const requests:string[]=[];const scan=await scanSportkartyabolt(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'google-site-verification=public-token\nSitemap: https://sportkartyabolt.hu/sitemap.xml' : sport;},wait:async()=>{}});
  assert.equal(scan.total,2);assert.deepEqual(requests,['https://sportkartyabolt.hu/robots.txt',SPORTKARTYABOLT_URL]);
  for(const robots of ['<html>error Sitemap: https://sportkartyabolt.hu/sitemap.xml</html>','Error: robots unavailable','User-agent: *\nDisallow: /'])await assert.rejects(scanSportkartyabolt(new AbortController().signal,{download:async()=>robots,wait:async()=>{}}));
});
test('RT Collectors Club: explicit filtered-list membership, no cart or variant checks, numeric product ID, own Shopify image and sale',()=>{
  const p=parseRtcollectorsclubPage(rt);assert.equal(p.total,2);assert.equal(p.products.length,2);assert.deepEqual(p.products.map(p=>p.externalID),['15399395819906','15399395819907']);assert.deepEqual(p.products.map(p=>p.priceHuf),[72499,12499]);
  assert.equal(p.products[0].image,'https://rtcollectorsclub.com/cdn/shop/files/booster.webp');assert.equal(p.products[1].availability,'preorder');assert.equal(p.products[0].url,'https://rtcollectorsclub.com/products/pokemon-example-box');
  assert.equal(parseRtcollectorsclubPage(rt.replace('72.499 Ft','72.499 EUR')).products[0].priceHuf,null);
  for(const html of [rt.replace('value="1" checked','value="0" checked'),rt.replace('3/2 termék','3/3 termék'),rt.replaceAll('15399395819907','15399395819906'),rt.replace('href="/products/pokemon-example-box?_pos=1"','href="https://other.example/products/pokemon"')])assert.throws(()=>parseRtcollectorsclubPage(html));
});
test('RT Collectors Club: removes prohibited sort/empty price filters, complete unique pagination, no product/cart GET',async()=>{
  const robots='User-agent: *\nDisallow: /collections/*sort_by*\nDisallow: /collections/*filter*&*filter*\nDisallow: /cart.js';
  const original=new URL(RTCOLLECTORSCLUB_URL);assert.equal(robotsPermission(robots,original.pathname+original.search).allowed,false);
  const first=rt.replaceAll('3/2 termék','6/4 termék'),second=first.replaceAll('15399395819906','15399395819908').replaceAll('15399395819907','15399395819909');
  const requests:string[]=[];const options={download:async(url:string)=>{requests.push(url);return url.endsWith('/robots.txt') ? robots : url.includes('page=2') ? second : first;},wait:async()=>{}};
  const scan=await scanRtcollectorsclub(new AbortController().signal,options);assert.equal(scan.total,4);assert.equal(scan.pages,2);assert.deepEqual(requests,['https://rtcollectorsclub.com/robots.txt',RTCOLLECTORSCLUB_CATALOG_URL,RTCOLLECTORSCLUB_CATALOG_URL+'&page=2']);
  await assert.rejects(scanRtcollectorsclub(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? robots : first}));
  await assert.rejects(scanRtcollectorsclub(new AbortController().signal,{...options,download:async(url)=>url.endsWith('/robots.txt') ? robots : url.includes('page=2') ? second.replaceAll('6/4 termék','6/5 termék') : first}));
});
test('Cardverse: FacetWP proves both filters and full count; icon cart uses accessible Kosárba label, product ID and HUF meta',()=>{
  const p=parseCardversePage(cv);assert.equal(p.total,2);assert.equal(p.products.length,2);assert.deepEqual(p.products.map(p=>p.externalID),['4835','4754']);assert.deepEqual(p.products.map(p=>p.priceHuf),[146990,11990]);
  assert.equal(p.products[0].sku,'TCG-7115067691919');assert.equal(p.products[0].image,'https://www.cardverse.hu/wp-content/uploads/wc-compressed/product-loop/4836.webp');assert.equal(p.products[1].availability,'in_stock');
  assert.throws(()=>parseCardversePage(cv.replace('Raktáron','Elfogyott')));
  assert.equal(parseCardversePage(cv.replace('role="button"','role="button" aria-disabled="true"')).products.length,1);
  assert.equal(parseCardversePage(cv.replace('content="HUF"','content="EUR"')).products[0].priceHuf,null);
});
test('Cardverse: wrong filter, partial/multi-page, missing/behavioral JSON, duplicate ID, button target or brand fails closed',()=>{
  for(const html of [cv.replace('"stock":["instock"]','"stock":["outofstock"]'),cv.replace('"brands":["pokemon-tcg"]','"brands":["one-piece"]'),cv.replace('"total_rows":2','"total_rows":3'),cv.replace('"total_pages":1','"total_pages":2'),cv.replace('window.FWP_JSON =','window.other ='),cv.replace(';</script>',';alert(1);</script>'),cv.replaceAll('4754','4835'),cv.replace('add-to-cart=4835','add-to-cart=999'),cv.replace('content="Pokémon TCG"','content="Another Brand"'),cv.replace('product_type_simple add_to_cart_button','product_type_simple renamed_cart')])assert.throws(()=>parseCardversePage(html));
});
test('Cardverse: only exact filtered category GET; never calls forbidden cart, JS API or nonce endpoint',async()=>{
  const requests:string[]=[];const scan=await scanCardverse(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /*?*add-to-cart=' : cv;},wait:async()=>{}});
  assert.equal(scan.total,2);assert.deepEqual(requests,['https://www.cardverse.hu/robots.txt',CARDVERSE_URL]);
});
test('New shops: fetch policies reject cross-origin, credentials, wrong filters, repeated params, cart/API/unknown pagination',()=>{
  const configs=[{url:TCGFUTAR_CATALOG_URL,policy:tcgfutarFetchUrl,bad:['?infinite_page=0','?infinite_page=51','?infinite_page=2&infinite_page=2','?sort=price']},{url:SPORTKARTYABOLT_URL,policy:sportkartyaboltFetchUrl,bad:['?page=2','?stock=1']},{url:RTCOLLECTORSCLUB_CATALOG_URL,policy:rtcollectorsclubFetchUrl,bad:['&sort_by=best-selling','&filter.v.price.gte=','&page=0','&page=','&page=51','&filter.v.availability=1']},{url:CARDVERSE_URL,policy:cardverseFetchUrl,bad:['&add-to-cart=4835','&_stock=instock','&page=2']}];
  for(const {url,policy,bad} of configs){assert.doesNotThrow(()=>policy(url));for(const suffix of bad)assert.throws(()=>policy(url+suffix));const u=new URL(url);for(const target of ['https://other.example'+u.pathname+u.search,u.origin+'/shop_ajax/ajax_cart.php',u.origin+'/robots.txt?x=1',url+'#x',url.replace('https://','https://u:p@')])assert.throws(()=>policy(target));}
  for(const input of ['javascript:alert(1)','https://other.example/products/pokemon','https://u:p@rtcollectorsclub.com/products/pokemon'])assert.throws(()=>rtcollectorsclubProductUrl(input));
  assert.throws(()=>cardverseProductUrl('https://www.cardverse.hu/kosar/'));assert.throws(()=>unasCategoryProductUrl('https://other.example/Pokemon','https://tcgfutar.hu','SKU',true));
});
for(const [id,name,products] of [['tcgfutar','TCG Futár',parseTcgfutarPage(tcg).products],['sportkartyabolt','Sport Kártya Bolt',parseSportkartyaboltPage(sport).products],['rtcollectorsclub','RT Collectors Club',parseRtcollectorsclubPage(rt).products],['cardverse','Cardverse',parseCardversePage(cv).products]] as const){
  test(`${name}: independent silent baseline, aggregate event/push name, failure preserves state; settings cancellation is scoped`,()=>{
    const db=new DatabaseSync(':memory:');initializeDatabase(db);
    const run=(list:PokemonProduct[],now:number)=>{db.prepare('UPDATE pokemon_shops SET next_scan=? WHERE id=?').run(now,id);const owner=claimScan(db,now,id)!;return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
    try{
      const otherIDs=SHOP_IDS.filter(other=>other!==id),before=otherIDs.map(other=>shop(db,other));registerTestPhone(db);
      assert.equal(run(products,1000).baseline,true);assert.equal(readPokemonSnapshot(db).latestEvents.length,0);assert.equal(run(products,700_000).events,0);
      assert.equal(run([...products,{...products[0],externalID:'NEW'}],1400_000).events,1);assert.equal(readPokemonSnapshot(db,false,5_000_000).latestEvents[0].shop_name,name);
      assert.ok(pushForShop(db,id).data.title.startsWith(name));
      cancelShopPush(db,'gamerunner');assert.equal(pushForShop(db,id).state,'queued');assert.equal(JSON.parse(claimPush(db,1400_002)!.payload).path,'/pokemon#shop-'+id);
      db.prepare('UPDATE pokemon_shops SET next_scan=0 WHERE id=?').run(id);const owner=claimScan(db,1400_003,id)!;failScan(db,owner,'Incomplete catalog',0,1400_004);assert.equal(shop(db,id).last_count,products.length+1);
      assert.deepEqual(otherIDs.map(other=>shop(db,other)),before);const preserved=shop(db,id);initializeDatabase(db);assert.deepEqual(shop(db,id),preserved);
    }finally{db.close();}
  });
}
