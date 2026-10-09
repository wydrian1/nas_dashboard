import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
import {DatabaseSync} from 'node:sqlite';
import {parseBloomriftPage,scanBloomrift,bloomriftProductUrl} from '../lib/pokemon/adapters/bloomrift.ts';
import {bloomriftFetchUrl,shopFetchUrl} from '../lib/pokemon/fetch-policy.ts';
import {BLOOMRIFT_URL,SHOP_IDS} from '../lib/pokemon/types.ts';
import {initializeDatabase} from '../lib/db-schema.ts';
import {shop,claimScan,finishScan,failScan} from '../lib/pokemon/store.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {registerTestPhone,pushForShop} from './helpers/push.ts';
const fixture=readFileSync(new URL('./fixtures/pokemon/bloomrift/catalog.html',import.meta.url),'utf8');
const robots='User-agent: Googlebot\nDisallow:\nUser-agent: *\nDisallow: /shop_ajax/*';
function multi(page:number,total=22){
  const $=load(fixture),template=$('#list-artlist_product_list > .product').first().toString(),pages=Math.ceil(total/12);
  $('.product-num').text(String(total));$('#list-artlist_product_list').empty();
  for(let i=(page-1)*12+1;i<=Math.min(page*12,total);i++)$('#list-artlist_product_list').append(template.replaceAll('PKM-EN-DEMO','PKM-EN-DEMO'+i).replaceAll('PKM__unas__EN__unas__DEMO','PKM__unas__EN__unas__DEMO'+i).replaceAll('pokemon-demo-booster','pokemon-demo-booster-'+i));
  if(page<pages){$('head').append(`<link rel="next" href="${BLOOMRIFT_URL},${page+1}">`);$('body').append(`<script>var infinite_scroll_num=${page};</script><div class="page_artlist_next_loading"><div data-page="${page+1}"></div></div>`);}
  if(page>1)$('head').append(`<link rel="prev" href="${BLOOMRIFT_URL}${page===2?'':','+(page-1)}">`);
  return $.html();
}
test('Bloomrift parser uses SKU/cart/stock proof, rejects details-only stock and parses HUF/image',()=>{
  const result=parseBloomriftPage(fixture);assert.equal(result.total,2);assert.equal(result.cardIDs.length,2);assert.equal(result.products.length,1);assert.equal(result.products[0].externalID,'PKM-EN-DEMO');assert.equal(result.products[0].priceHuf,2290);assert.equal(result.products[0].availability,'in_stock');assert.match(result.products[0].image!,/^https:\/\/bloomrift.eu\/img\//);
  assert.equal(parseBloomriftPage(fixture.replace('<button class="product__cart-btn"','<button disabled class="product__cart-btn"')).products.length,0);
  assert.equal(parseBloomriftPage(fixture.replace('class="product-main-btn"','hidden class="product-main-btn"')).products.length,0);
  assert.equal(parseBloomriftPage(fixture.replace('2 290 Ft','€20')).products[0].priceHuf,null);
  assert.equal(parseBloomriftPage(fixture.replace('Raktáron</div>','Előrendelhető</div>')).products[0].availability,'preorder');
  assert.equal(parseBloomriftPage(fixture.replace('https://bloomrift.eu/img/','https://evil.example/img/')).products[0].image,null);
  assert.equal(parseBloomriftPage(fixture.replace('2 290 Ft</div>','2 290 Ft</div><div class="product__price-sale">1 990 Ft</div>')).products[0].priceHuf,1990);
});
test('Bloomrift parser fails closed on broken category, count, card identity/cart/stock/link and pagination',()=>{
  const bad=[fixture.replace('Összes angol termék','Más kategória'),fixture.replace('page_shop_art_948779','unknown'),fixture.replace('rel="canonical"','rel="other"'),fixture.replace('</span>2','</span>0'),fixture.replace('PKM__unas__EN__unas__DEMO\',','MISMATCH\','),fixture.replace('Raktáron</div>','Érdeklődj</div>'),fixture.replace('value="1"','value="0"'),fixture.replace('class="product__details-btn"','class="unknown"'),fixture.replaceAll('pokemon-demo-booster','shop_ajax/cart'),fixture.replaceAll('https://bloomrift.eu/pokemon-demo','https://evil.example/pokemon-demo')];
  for(const html of bad)assert.throws(()=>parseBloomriftPage(html));
  assert.throws(()=>parseBloomriftPage(multi(1),2));assert.throws(()=>parseBloomriftPage(multi(1).replaceAll('termek,2','termek,3')));assert.throws(()=>parseBloomriftPage(multi(1).replace('data-page="2"','data-page="3"')));
  assert.throws(()=>parseBloomriftPage(multi(1).replace('infinite_scroll_num=1','infinite_scroll_num=2')));assert.throws(()=>parseBloomriftPage(multi(2).replaceAll('DEMO22','DEMO21'),2));
});
test('Bloomrift fetch policy is category/robots only: no AJAX, cart, products, sorting, foreign hosts or excessive pages',()=>{
  for(const url of [BLOOMRIFT_URL,BLOOMRIFT_URL+',2',BLOOMRIFT_URL+',50','https://bloomrift.eu/robots.txt']){assert.equal(bloomriftFetchUrl(url).href,url);assert.equal(shopFetchUrl(url).href,url);}
  for(const url of [BLOOMRIFT_URL+',0',BLOOMRIFT_URL+',1',BLOOMRIFT_URL+',01',BLOOMRIFT_URL+',51',BLOOMRIFT_URL+'?infinite_page=2',BLOOMRIFT_URL+'?sort=price',BLOOMRIFT_URL+'#x','https://bloomrift.eu/shop_ajax/cart.php','https://bloomrift.eu/pokemon-demo','https://bloomrift.eu/kosar','https://evil.example/robots.txt','https://u:p@bloomrift.eu/robots.txt','http://bloomrift.eu/robots.txt','https://bloomrift.eu:444/robots.txt'])assert.throws(()=>bloomriftFetchUrl(url));
  for(const url of ['https://evil.example/pokemon-demo','https://u:p@bloomrift.eu/pokemon-demo','/pokemon-demo?cart=1','/pokemon-demo#x','/shop_ajax/cart'])assert.throws(()=>bloomriftProductUrl(url));
});
test('Bloomrift scanner proves every page plus stable head/tail, robots delays, and never fetches products or AJAX',async()=>{
  const requests:string[]=[],waits:number[]=[];
  const result=await scanBloomrift(new AbortController().signal,{download:async url=>{bloomriftFetchUrl(url);requests.push(url);return url.endsWith('robots.txt')?robots:url.endsWith(',2')?multi(2):multi(1);},wait:async ms=>{waits.push(ms);}});
  assert.equal(result.total,22);assert.equal(result.pages,2);assert.deepEqual(requests,['https://bloomrift.eu/robots.txt',BLOOMRIFT_URL,BLOOMRIFT_URL+',2',BLOOMRIFT_URL,BLOOMRIFT_URL+',2']);assert.ok(waits.every(ms=>ms>=1500));
  const single=await scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?robots:fixture,wait:async()=>{}});assert.equal(single.total,1);assert.equal(single.pages,1);
});
test('Bloomrift scanner rejects duplicates, changed counts/head/tail, blocked robots, truncation and abort',async()=>{
  for(const bad of [multi(2,23),multi(2).replaceAll('DEMO22','DEMO1'),multi(2).replaceAll('class="product"','class="missing"')])await assert.rejects(scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?robots:url.endsWith(',2')?bad:multi(1),wait:async()=>{}}));
  for(const edge of [1,2]){let calls=0;await assert.rejects(scanBloomrift(new AbortController().signal,{download:async url=>{if(url.endsWith('robots.txt'))return robots;const page=url.endsWith(',2')?2:1;return page===edge&&++calls>1?multi(page).replace('Pokémon Demo Booster','Changed'):multi(page);},wait:async()=>{}}));}
  for(const source of ['<html>Error</html>','Unavailable','User-agent: *\nDisallow: /Osszes-angol-termek','User-agent: *\nDisallow: /Osszes-angol-termek,2'])await assert.rejects(scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?source:url.endsWith(',2')?multi(2):multi(1),wait:async()=>{}}));
  const abort=new AbortController();abort.abort();await assert.rejects(scanBloomrift(abort.signal,{download:async()=>robots,wait:async()=>{}}));
});
test('Bloomrift initialization preserves old shops, devices and settings; silent baseline then named stock/preorder push, failures preserve products',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);const products=parseBloomriftPage(fixture).products;
  try{
    db.exec("DELETE FROM pokemon_user_notifications WHERE shop_id='bloomrift';DELETE FROM pokemon_shops WHERE id='bloomrift';UPDATE pokemon_shops SET interval_minutes=8 WHERE id='mythgames'");const old=SHOP_IDS.filter(id=>id!=='bloomrift'),before=old.map(id=>shop(db,id));registerTestPhone(db);const phones=JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all());initializeDatabase(db);
    assert.deepEqual(old.map(id=>shop(db,id)),before);assert.equal(JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),phones);assert.equal(shop(db,'bloomrift').interval_minutes,3);assert.equal(shop(db,'bloomrift').url,BLOOMRIFT_URL);
    const run=(list:typeof products,now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='bloomrift'").run(now);return finishScan(db,claimScan(db,now,'bloomrift')!,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
    assert.equal(run(products,1000).baseline,true);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);assert.equal(run(products,700000).events,0);assert.equal(run([],1400000).deferred,true);assert.equal(run([],1600000).events,0);assert.equal(run([],1800000).events,0);assert.equal(run(products,2100000).events,1);
    assert.match(pushForShop(db,'bloomrift').data.title,/^Bloomrift/);assert.equal(pushForShop(db,'bloomrift').data.path,'/pokemon#shop-bloomrift');const payload=JSON.parse(pushForShop(db,'bloomrift').payload);assert.equal(payload.kind,'product');assert.equal(payload.shopId,'bloomrift');assert.equal(payload.productUrl,products[0].url);
    assert.equal(readPokemonSnapshot(db,false,2100002).latestEvents[0].shop_name,'Bloomrift');
    assert.equal(run([...products,{...products[0],externalID:'PRE',availability:'preorder'}],2800000).events,1);
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='bloomrift'");failScan(db,claimScan(db,3500000,'bloomrift')!,'Incomplete',0,3500001);assert.equal(shop(db,'bloomrift').last_count,2);const saved=shop(db,'bloomrift');initializeDatabase(db);assert.deepEqual(shop(db,'bloomrift'),saved);assert.deepEqual(old.map(id=>shop(db,id)),before);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
