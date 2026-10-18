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
function numbered(page:number){
  const $=load(multi(page,27));$('script,.page_artlist_next_loading').remove();
  for(let index=0;index<2;index++)$('body').append(`<div class="paging-sorting-ordering"><div><input class="page-input" type="number" step="1" min="1" max="3" value="${page}" data-direct-link="${BLOOMRIFT_URL},[page_selected]"><span class="page-item__last-page-text">3</span></div></div>`);
  return $.html();
}
test('Bloomrift validates numbered middle pages as well as infinite scroll, including page/count/link proof',async()=>{
  assert.equal(parseBloomriftPage(numbered(2),2).cardIDs.length,12);
  for(const html of [numbered(2).replace('value="2"','value="3"'),numbered(2).replace('max="3"','max="4"'),numbered(2).replace('min="1"','min="0"'),numbered(2).replace('https://bloomrift.eu/Osszes-angol-termek,[page_selected]','https://evil.example/[page_selected]'),numbered(2).replace('class="page-input"','class="missing"')])assert.throws(()=>parseBloomriftPage(html,2));
  const result=await scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?robots:url.endsWith(',2')?numbered(2):url.endsWith(',3')?multi(3,27):multi(1,27),wait:async()=>{}});
  assert.equal(result.pages,3);assert.equal(result.total,27);
});
test('Bloomrift parser uses SKU/cart/stock proof, rejects details-only stock and parses HUF/image',()=>{
  const result=parseBloomriftPage(fixture);assert.equal(result.total,2);assert.equal(result.cardIDs.length,2);assert.equal(result.products.length,1);assert.equal(result.products[0].externalID,'PKM-EN-DEMO');assert.equal(result.products[0].priceHuf,2290);assert.equal(result.products[0].availability,'in_stock');assert.match(result.products[0].image!,/^https:\/\/bloomrift.eu\/img\//);
  assert.equal(parseBloomriftPage(fixture.replace('<button class="product__cart-btn"','<button disabled class="product__cart-btn"')).products.length,0);
  assert.equal(parseBloomriftPage(fixture.replace('class="product-main-btn"','hidden class="product-main-btn"')).products.length,0);
  assert.equal(parseBloomriftPage(fixture.replace('2 290 Ft','€20')).products[0].priceHuf,null);
  assert.equal(parseBloomriftPage(fixture.replace('Raktáron</div>','Előrendelhető</div>')).products[0].availability,'preorder');
  assert.equal(parseBloomriftPage(fixture.replace('https://bloomrift.eu/img/','https://evil.example/img/')).products[0].image,null);
  assert.equal(parseBloomriftPage(fixture.replace('2 290 Ft</div>','2 290 Ft</div><div class="product__price-sale">1 990 Ft</div>')).products[0].priceHuf,1990);
});
test('Bloomrift unknown cart or stock states do not fail a complete scan or infer availability',async()=>{
  const missingCart=fixture.replace('<button class="product__cart-btn" type="button" aria-label="Kosárba" data-text="Kosárba" onclick="cart_add(\'PKM__unas__EN__unas__DEMO\',\'artlist_\');">Kosárba</button><input name="db_artlist_PKM__unas__EN__unas__DEMO" id="db_artlist_PKM__unas__EN__unas__DEMO" type="hidden" value="1">','<a class="product__details-btn" aria-label="Részletek" href="https://bloomrift.eu/pokemon-demo-booster">Részletek</a>');
  const unknownStock=fixture.replace('Raktáron</div>','Készlet ellenőrzése</div>');
  for(const html of [missingCart,unknownStock]){const parsed=parseBloomriftPage(html);assert.equal(parsed.cardIDs.length,2);assert.equal(parsed.products.length,0);assert.equal(parsed.diagnostics.length,1);assert.equal(parsed.diagnostics[0].type,'unknown_product_state');assert.equal(parsed.diagnostics[0].sku,'PKM-EN-DEMO');assert.equal(parsed.diagnostics[0].title,'Pokémon Demo Booster');assert.equal(parsed.diagnostics[0].page,1);assert.equal(parsed.diagnostics[0].stockText,html===unknownStock?'Készlet ellenőrzése':'Raktáron');}
  const result=await scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?robots:unknownStock,wait:async()=>{}});
  assert.equal(result.total,0);
  const diagnostics=result.diagnostics||[];assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].sku,'PKM-EN-DEMO');assert.equal(diagnostics[0].cartButtons.length,1);assert.equal(diagnostics[0].quantityInputs,1);
  assert.deepEqual(result.uncertainIDs,['PKM-EN-DEMO']);
});
test('Bloomrift parser fails closed on broken category, count, card identity/cart/stock/link and pagination',()=>{
  const wrongHeading=load(fixture);wrongHeading('h1').text('Másik kategória');
  const bad=[wrongHeading.html()!,fixture.replace('page_shop_art_948779','unknown'),fixture.replace('rel="canonical"','rel="other"'),fixture.replace('</span>2','</span>0'),fixture.replaceAll('pokemon-demo-booster','shop_ajax/cart'),fixture.replaceAll('https://bloomrift.eu/pokemon-demo','https://evil.example/pokemon-demo')];
  for(const html of bad)assert.throws(()=>parseBloomriftPage(html));
  assert.throws(()=>parseBloomriftPage(multi(1),2));assert.throws(()=>parseBloomriftPage(multi(1).replaceAll('termek,2','termek,3')));assert.throws(()=>parseBloomriftPage(multi(1).replace('data-page="2"','data-page="3"')));
  assert.throws(()=>parseBloomriftPage(multi(1).replace('infinite_scroll_num=1','infinite_scroll_num=2')));assert.throws(()=>parseBloomriftPage(multi(2).replaceAll('DEMO22','DEMO21'),2));
});
function memberGate(html=fixture){
  const $=load(html),card=$('[data-sku="PKM-EN-SOLD"].product');
  card.find('.product-main-btn').replaceWith('<div class="product__main"><div class="product__main-btn-col"><div class="not-buyable__text">A termék kizárólag regisztrált és bejelentkezett felhasználók számára érhető el!</div></div></div>');
  return $.html();
}
test('Bloomrift recognizes exactly the anonymous member-only unavailable card without losing public stock or SKU identity',()=>{
  const before=parseBloomriftPage(fixture),after=parseBloomriftPage(memberGate());
  assert.deepEqual(after,before);
  for(const bad of [memberGate().replace('Nincs raktáron','Raktáron'),memberGate().replace('stock no-stock','stock on-stock'),memberGate().replace('regisztrált és bejelentkezett','bejelentkezett'),memberGate().replace('PKM__unas__EN__unas__SOLD','BROKEN'),memberGate().replace('</div></div></div>','</div><button class="product__cart-btn">Kosárba</button></div></div>')])assert.throws(()=>parseBloomriftPage(bad));
});
test('Bloomrift scanner includes member-gated SKU in completeness proof and leaves anonymous gate with uncertain stock as a failure',async()=>{
  const result=await scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?robots:memberGate(),wait:async()=>{}});
  assert.equal(result.total,1);assert.deepEqual(result.products,parseBloomriftPage(fixture).products);
  await assert.rejects(scanBloomrift(new AbortController().signal,{download:async url=>url.endsWith('robots.txt')?robots:memberGate().replace('Nincs raktáron','Raktáron'),wait:async()=>{}}));
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
  const db=new DatabaseSync(':memory:');initializeDatabase(db);const products=[...parseBloomriftPage(fixture).products,{...parseBloomriftPage(fixture).products[0],externalID:'PKM-EN-DEMO2',sku:'PKM-EN-DEMO2'}];
  try{
    db.exec("DELETE FROM pokemon_user_notifications WHERE shop_id='bloomrift';DELETE FROM pokemon_shops WHERE id='bloomrift';UPDATE pokemon_shops SET interval_minutes=8 WHERE id='mythgames'");const old=SHOP_IDS.filter(id=>id!=='bloomrift'),before=old.map(id=>shop(db,id));registerTestPhone(db);const phones=JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all());initializeDatabase(db);
    assert.deepEqual(old.map(id=>shop(db,id)),before);assert.equal(JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),phones);assert.equal(shop(db,'bloomrift').interval_minutes,3);assert.equal(shop(db,'bloomrift').url,BLOOMRIFT_URL);
    const run=(list:typeof products,now:number,uncertainIDs:string[]=[] )=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='bloomrift'").run(now);return finishScan(db,claimScan(db,now,'bloomrift')!,{products:list,total:list.length,pages:1,scannedAt:now,uncertainIDs},now+1);};
    assert.equal(run(products,1000).baseline,true);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);assert.equal(run([products[0]],500000,['PKM-EN-DEMO2']).events,0);const uncertain=db.prepare("SELECT in_stock,missing_count FROM pokemon_products WHERE shop_id='bloomrift' AND external_id='PKM-EN-DEMO2'").get()!;assert.equal(uncertain.in_stock,1);assert.equal(uncertain.missing_count,0);assert.equal(run(products,700000).events,0);assert.equal(run([],1400000).deferred,true);assert.equal(run([],1600000).events,0);assert.equal(run([],1800000).events,0);assert.equal(run(products,2100000).events,2);
    assert.match(pushForShop(db,'bloomrift').data.title,/^Bloomrift/);assert.equal(pushForShop(db,'bloomrift').data.path,'/pokemon#shop-bloomrift');const payload=JSON.parse(pushForShop(db,'bloomrift').payload);assert.equal(payload.kind,'product');assert.equal(payload.shopId,'bloomrift');assert.equal(payload.productUrl,products[0].url);
    assert.equal(readPokemonSnapshot(db,false,2100002).latestEvents[0].shop_name,'Bloomrift');
    assert.equal(run([...products,{...products[0],externalID:'PRE',availability:'preorder'}],2800000).events,1);
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='bloomrift'");failScan(db,claimScan(db,3500000,'bloomrift')!,'Incomplete',0,3500001);assert.equal(shop(db,'bloomrift').last_count,3);const saved=shop(db,'bloomrift');initializeDatabase(db);assert.deepEqual(shop(db,'bloomrift'),saved);assert.deepEqual(old.map(id=>shop(db,id)),before);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
