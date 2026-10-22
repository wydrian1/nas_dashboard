import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {load} from 'cheerio';
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseGeekempirePage, scanGeekempire, geekempireProductUrl } from "../lib/pokemon/adapters/geekempire.ts";
import { geekempireFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { robotsPermission } from "../lib/pokemon/robots.ts";
import { GEEKEMPIRE_URL, SHOP_IDS, type PokemonProduct } from "../lib/pokemon/types.ts";
import { shop, claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { readPokemonSnapshot } from "../lib/pokemon/snapshot.ts";

const fixture=readFileSync(new URL('./fixtures/pokemon/geekempire/catalog.html',import.meta.url),'utf8');
const products=parseGeekempirePage(fixture).products;
const robots='User-agent: *\nDisallow: /*add-to-cart=*\nDisallow: /kosar/\nDisallow: /checkout/\nCrawl-delay: 5';
function reservedPage(){const $=load(fixture),card=$('li.post-113394');card.find('.stock').text('Foglalt');card.children('a.button').remove();return $;}
function comingSoonPage(){const $=load(fixture),card=$('li.post-113394');card.addClass('onbackorder product_tag-hamarosan');card.find('.stock').text('Előrendelhető');card.children('a.button').replaceWith('<a class="button product_type_simple" href="/termek/pokemon-example-box/">Hamarosan</a>');return $;}
test('GeekEmpire: observed Hamarosan details button without cart ID counts toward completeness but not availability',async()=>{
  const $=comingSoonPage(),parsed=parseGeekempirePage($.html());
  assert.equal(parsed.total,3);assert.deepEqual(parsed.cardIDs,['113394','115714','31882']);assert.deepEqual(parsed.products.map(p=>p.externalID),['115714']);
  assert.equal(parsed.products[0].availability,'preorder'); // The other active preorder remains available.
  const requests:string[]=[];const result=await scanGeekempire(AbortSignal.timeout(5000),{download:async url=>{requests.push(url);return url.endsWith('/robots.txt')?robots:$.html();},wait:async()=>{}});
  assert.equal(result.total,1);assert.equal(result.pages,1);assert.deepEqual(requests,['https://geekempire.hu/robots.txt',GEEKEMPIRE_URL]);
  const button=$('li.post-113394 > a.button');button.attr('data-product_id','113394').text('  HAMAROSAN  ');
  assert.deepEqual(parseGeekempirePage($.html()).products,parsed.products);
  button.text('Kosárba').addClass('add_to_cart_button').attr('href',GEEKEMPIRE_URL+'?add-to-cart=113394');
  assert.deepEqual(parseGeekempirePage($.html()).products.map(p=>p.externalID),['113394','115714']); // Tag/name alone never excludes a real preorder cart.
});
test('GeekEmpire: Hamarosan exception keeps identity, category, own details link, button and completeness checks',()=>{
  const html=comingSoonPage().html();
  for(const invalid of [html.replace('post-113394','post-113394 post-999'),html.replace('post-113394','missing-id'),html.replace('product_cat-pokemon-kartya','product_cat-other'),html.replace('Mind a(z) 3','Mind a(z) 4'),html.replaceAll('31882','113394')])assert.throws(()=>parseGeekempirePage(invalid));
  const invalidAttributes:Record<string,string>[]=[{href:'https://other.example/termek/pokemon-example-box/'},{href:'/termek/other-product/'},{href:'/termek/pokemon-example-box/?add-to-cart=113394'},{href:'/termek/pokemon-example-box/#buy'},{'data-product_id':'999'},{class:'button product_type_simple add_to_cart_button'},{class:'button product_type_variable'}];
  for(const attrs of invalidAttributes){
    const $=load(html);$('li.post-113394 > a.button').attr(attrs);assert.throws(()=>parseGeekempirePage($.html()));
  }
  for(const text of ['Tovább','Hamarosan Kosárba','Ismeretlen']){const $=load(html);$('li.post-113394 > a.button').text(text);assert.throws(()=>parseGeekempirePage($.html()));}
  for(const duplicate of [false,true]){const $=load(html),button=$('li.post-113394 > a.button');if(duplicate)button.after(button.clone());else button.remove();assert.throws(()=>parseGeekempirePage($.html()));}
});
test('GeekEmpire: explicit reserved stock without a cart button retains card completeness and skips only that item',async()=>{
  const $=reservedPage(),html=$.html(),parsed=parseGeekempirePage(html);
  assert.equal(parsed.total,3);assert.deepEqual(parsed.cardIDs,['113394','115714','31882']);assert.deepEqual(parsed.products.map(p=>p.externalID),['115714']);
  const requests:string[]=[];const scan=await scanGeekempire(new AbortController().signal,{download:async url=>{requests.push(url);return url.endsWith('/robots.txt')?robots:html;},wait:async()=>{}});
  assert.equal(scan.total,1);assert.deepEqual(requests,['https://geekempire.hu/robots.txt',GEEKEMPIRE_URL]);
  $('li.post-113394').append('<a class="button product_type_simple" href="/termek/pokemon-example-box/">Tovább</a>');
  assert.deepEqual(parseGeekempirePage($.html()).products.map(p=>p.externalID),['115714']);
  assert.equal(parseGeekempirePage(fixture.replace('Készleten','Foglalt')).products.length,1);
});
test('GeekEmpire: reserved handling never excuses broken identity, unsafe details, ambiguous labels or unknown missing buttons',()=>{
  const $=reservedPage(),html=$.html();
  for(const invalid of [html.replace('post-113394','post-113394 post-999'),html.replace('class="woocommerce-loop-product__link"','class="missing-link"'),html.replace('/termek/pokemon-example-box/','https://other.example/termek/pokemon-example-box/'),html.replace('Foglalt','Ismeretlen'),html.replace('Foglalt','Készleten'),html.replace('Foglalt','Nem foglalt'),html.replace('Foglalt','</p><p class="stock">Foglalt'),html.replace('Foglalt','Készleten').replace('Pokemon Example Box','Foglalt Pokemon Example Box')])assert.throws(()=>parseGeekempirePage(invalid));
  for(const button of ['<a class="button" data-product_id="999" href="/termek/pokemon-example-box/">Tovább</a>','<a class="button" href="https://other.example/termek/pokemon-example-box/">Tovább</a>','<a class="button" href="/termek/pokemon-example-box/?buy=1">Tovább</a>','<a class="button" href="/termek/pokemon-example-box/">Kosárba</a>','<a class="button" href="/termek/pokemon-example-box/">Tovább</a><a class="button" href="/termek/pokemon-example-box/">Tovább</a>']){
    const copy=load(html);copy('li.post-113394').append(button);assert.throws(()=>parseGeekempirePage(copy.html()));
  }
});
test('GeekEmpire: complete WooCommerce list, stable IDs, SKU, sale price, own upload images and details exclusion',()=>{
  assert.equal(parseGeekempirePage(fixture).total,3);assert.deepEqual(products.map(p=>p.externalID),['113394','115714']);
  assert.deepEqual(products.map(p=>p.availability),['in_stock','preorder']);assert.deepEqual(products.map(p=>p.priceHuf),[128990,2490]);
  assert.equal(products[0].sku,'4521329431536');assert.equal(products[0].image,'https://geekempire.hu/wp-content/uploads/2026/03/example.webp');
  assert.equal(products[1].image,'https://geekempire.hu/wp-content/uploads/2026/03/booster.webp');
  const variable=fixture.replace('class="button product_type_simple"','class="button product_type_variable add_to_cart_button"');
  assert.equal(parseGeekempirePage(variable).products.length,2); // Options links may reuse add-to-cart CSS but aren't active cart buttons.
  assert.equal(parseGeekempirePage(fixture.replace('class="button product_type_simple"','class="button product_type_variable"')).products.length,2);
});
test('GeekEmpire: active cart authoritative, disabled cart excluded, optional invalid HUF price/image becomes null',()=>{
  assert.equal(parseGeekempirePage(fixture.replace('Készleten','Elfogyott')).products[0].availability,'available');
  assert.equal(parseGeekempirePage(fixture.replace('class="button product_type_simple add_to_cart_button ajax_add_to_cart"','class="button product_type_simple add_to_cart_button ajax_add_to_cart" disabled')).products.length,1);
  assert.equal(parseGeekempirePage(fixture.replace('128 990 Ft','128 990 EUR')).products[0].priceHuf,null);
  assert.equal(parseGeekempirePage(fixture.replace('https://geekempire.hu/wp-content/uploads/2026/03/example.webp','https://unsafe.example/img.webp')).products[0].image,null);
});
test('GeekEmpire: exact category, observed duplicate canonical, total card IDs and cart action validated; partial/paginated list fails closed',()=>{
  for(const html of [fixture.replace('class="tax-product_cat term-pokemon-kartya"','class="other-category"'),fixture.replace('https://geekempire.hu/termekkategoria/pokemon-kartya/','https://other.example/category/'),fixture.replace('Mind a(z) 3','Mind a(z) 4'),fixture.replaceAll('31882','113394'),fixture.replace('data-product_id="113394"','data-product_id="999"'),fixture.replace('?add-to-cart=113394','?add-to-cart=999'),fixture.replace('class="button product_type_simple add_to_cart_button ajax_add_to_cart"','class="button product_type_simple renamed_cart"'),fixture.replace('</body>','<nav class="woocommerce-pagination">2</nav></body>')])assert.throws(()=>parseGeekempirePage(html));
  for(const url of [GEEKEMPIRE_URL+'?add-to-cart=113394',GEEKEMPIRE_URL+'?yith_wcan=1',GEEKEMPIRE_URL+'page/2/','https://geekempire.hu/wp-json/wc/store/products','https://geekempire.hu/kosar/','https://geekempire.hu/robots.txt?x=1'])assert.throws(()=>geekempireFetchUrl(url));
  for(const url of ['javascript:alert(1)','https://other.example/termek/pokemon/','https://u:p@geekempire.hu/termek/pokemon/','https://geekempire.hu/kosar/'])assert.throws(()=>geekempireProductUrl(url));
});
test('GeekEmpire: honor 5s robots delay; only robots/category GET, never forbidden add-to-cart or product links',async()=>{
  assert.equal(robotsPermission(robots,new URL(GEEKEMPIRE_URL).pathname+'?add-to-cart=113394').allowed,false);
  const requests:string[]=[],waits:number[]=[];
  const scan=await scanGeekempire(new AbortController().signal,{download:async(url)=>{requests.push(url);return url.endsWith('/robots.txt') ? robots : fixture;},wait:async(ms)=>{waits.push(ms);}});
  assert.equal(scan.total,2);assert.equal(scan.pages,1);assert.deepEqual(requests,['https://geekempire.hu/robots.txt',GEEKEMPIRE_URL]);assert.deepEqual(waits,[5000]);
  const blocked:string[]=[];await assert.rejects(scanGeekempire(new AbortController().signal,{download:async(url)=>{blocked.push(url);return 'User-agent: *\nDisallow: /termekkategoria/';},wait:async()=>{}}));assert.equal(blocked.length,1);
});
test('GeekEmpire: silent independent baseline, own aggregate event/push, failed scan and initialization preserve state',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const run=(list:PokemonProduct[],now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='geekempire'").run(now);const owner=claimScan(db,now,'geekempire')!;return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
  try{
    const otherIDs=SHOP_IDS.filter(id=>id!=='geekempire'),before=otherIDs.map(id=>shop(db,id));registerTestPhone(db);
    assert.equal(run(products,1000).baseline,true);assert.deepEqual(readPokemonSnapshot(db).latestEvents,[]);assert.equal(run(products,700_000).events,0);
    assert.equal(run([...products,{...products[0],externalID:'NEW'}],1400_000).events,1);assert.equal(readPokemonSnapshot(db,false,5_000_000).latestEvents[0].shop_name,'GeekEmpire');
    assert.match(pushForShop(db,'geekempire').data.title,/^GeekEmpire/);
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='geekempire'");const owner=claimScan(db,1400_003,'geekempire')!;failScan(db,owner,'Partial list',0,1400_004);assert.equal(shop(db,'geekempire').last_count,3);
    assert.deepEqual(otherIDs.map(id=>shop(db,id)),before);const preserved=shop(db,'geekempire');initializeDatabase(db);assert.deepEqual(shop(db,'geekempire'),preserved);
  }finally{db.close();}
});
