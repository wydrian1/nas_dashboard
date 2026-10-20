import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {load} from 'cheerio';
import {parseTcgboltPage,scanTcgbolt,tcgboltProductUrl} from '../lib/pokemon/adapters/tcgbolt.ts';
import {tcgboltFetchUrl,shopFetchUrl} from '../lib/pokemon/fetch-policy.ts';
import {TCGBOLT_URL,SHOP_IDS,SHOP_NAMES} from '../lib/pokemon/types.ts';
import {initializeDatabase} from '../lib/db-schema.ts';
import {claimScan,finishScan,failScan,shop} from '../lib/pokemon/store.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {registerTestPhone,pushForShop} from './helpers/push.ts';
import {cancelShopPush} from '../lib/mobile/store.ts';
const fixture=readFileSync(new URL('./fixtures/pokemon/tcgbolt/catalog.html',import.meta.url),'utf8');
const robots='User-agent: *\nDisallow: /*?add-to-cart=\nDisallow: /*?*add-to-cart=\nDisallow: /wp-admin/\nCrawl-delay: 1';
function multi(page:number,total=31){
  const $=load(fixture),first=(page-1)*30+1,last=Math.min(page*30,total),template=$('li.product').first().toString();
  $('link[rel="canonical"]').attr('href',page===1?TCGBOLT_URL:TCGBOLT_URL+'page/'+page+'/');
  $('.woocommerce-result-count').text(`${first}–${last} termék, összesen ${total} db`);
  $('ul.products').html(Array.from({length:last-first+1},(_,i)=>template.replaceAll('1001',String(1000+first+i)).replaceAll('/pokemon/?','/pokemon/'+(page===1?'':'page/'+page+'/')+'?')).join(''));
  $('.woocommerce').append(`<nav class="woocommerce-pagination"><ul class="page-numbers">${page>1?'<li><a class="prev page-numbers" href="'+TCGBOLT_URL+'page/1/">←</a></li>':''}${[1,2].map(n=>n===page?'<li><span class="page-numbers current" aria-current="page">'+n+'</span></li>':'<li><a class="page-numbers" href="'+TCGBOLT_URL+'page/'+n+'/">'+n+'</a></li>').join('')}${page===1?'<li><a class="next page-numbers" href="'+TCGBOLT_URL+'page/2/">→</a></li>':''}</ul></nav>`);
  return $.html();
}
test('TCG Bolt parser counts all category cards, but includes only active simple cart; ignores Quick View and options/unavailable cards',()=>{
  const result=parseTcgboltPage(fixture);assert.equal(result.total,4);assert.equal(result.cardIDs.length,4);assert.deepEqual(result.products.map(p=>p.externalID),['1001','1002']);assert.deepEqual(result.products.map(p=>p.priceHuf),[2000,600]);assert.equal(result.products[0].sku,'PACK-1');assert.equal(result.products[0].image,'https://i0.wp.com/tcgbolt.hu/wp-content/uploads/2026/10/demo.webp?resize=300%2C300&ssl=1');assert.equal(result.products[1].title,'Demo Sleeves');assert.ok(result.products.every(p=>p.availability==='in_stock'));
  assert.equal(parseTcgboltPage(fixture.replace('data-product_id="1001" data-product_sku','aria-disabled="true" data-product_id="1001" data-product_sku')).products.length,1);
  assert.equal(parseTcgboltPage(fixture.replace('post-1001 product_cat-pokemon instock','post-1001 product_cat-pokemon onbackorder').replace('<span class="price">','<span class="stock">Előrendelhető</span><span class="price">')).products[0].availability,'preorder');
  assert.equal(parseTcgboltPage(fixture.replace('2.000&nbsp;Ft','1.234,50&nbsp;Ft')).products[0].priceHuf,1234.5);
  for(const bad of ['2.000&nbsp;EUR','unknown','12.34&nbsp;Ft'])assert.equal(parseTcgboltPage(fixture.replace('2.000&nbsp;Ft',bad)).products[0].priceHuf,null);
  assert.equal(parseTcgboltPage(fixture.replace('i0.wp.com/tcgbolt.hu/wp-content/uploads/','i0.wp.com/other.example/wp-content/uploads/')).products[0].image,null);
});
test('TCG Bolt accepts accessory-only taxonomy within the verified category without weakening identity, link or cart checks',()=>{
  const $=load(fixture);
  for(const [id,title] of [['1001','ECLIPSE 9-Pocket PRO-BINDER® Ultra PRO Mappa – Smoke Grey'],['1002','ECLIPSE 9-Pocket PRO-BINDER® Ultra PRO Mappa – Arctic White']]){
    const card=$('li.post-'+id);card.removeClass('product_cat-pokemon').addClass('product_cat-kiegeszitok product_cat-tcg-kiegeszitok');card.find('.woocommerce-loop-product__title').text(title);
  }
  const html=$.html(),parsed=parseTcgboltPage(html);
  assert.equal(parsed.total,4);assert.deepEqual(parsed.products.map(p=>p.externalID),['1001','1002']);assert.ok(parsed.products.every(p=>p.title.startsWith('ECLIPSE')));
  for(const invalid of [html.replace('post-1001','post-1001 post-999'),html.replace('post-1001','missing-id'),html.replace('data-product_id="1001"','data-product_id="999"'),html.replace('?add-to-cart=1001','?add-to-cart=999'),html.replace('https://tcgbolt.hu/bolt/pokemon-demo-booster/','https://other.example/bolt/pokemon-demo-booster/'),html.replace('term-pokemon','term-other'),html.replace('https://tcgbolt.hu/termekkategoria/pokemon/','https://tcgbolt.hu/termekkategoria/kiegeszitok/')])assert.throws(()=>parseTcgboltPage(invalid));
  const outside=load(html),extra=outside('li.post-1001').clone();extra.attr('class','product post-9999 instock purchasable');outside('body').append(extra);
  assert.deepEqual(parseTcgboltPage(outside.html()),parsed); // Not a direct card in the verified list.
});
test('TCG Bolt parser fails closed on wrong category, partial/duplicate lists, unverified empty page and cart/ID/stock mismatch',()=>{
  for(const html of [fixture.replace('term-pokemon','term-other'),fixture.replace('Pokémon</h1>','Other</h1>'),fixture.replace('Mind a(z) 4','Mind a(z) 5'),fixture.replaceAll('1004','1001'),fixture.replace('data-product_id="1001"','data-product_id="999"'),fixture.replace('?add-to-cart=1001','?add-to-cart=999'),fixture.replace('product_type_simple add_to_cart_button ajax_add_to_cart','product_type_simple unknown_button'),fixture.replace('post-1001 product_cat-pokemon instock','post-1001 product_cat-pokemon outofstock'),fixture.replace('Kosárba teszem','Buy'),fixture.replace('https://tcgbolt.hu/bolt/pokemon-demo-booster/','https://other.example/bolt/pokemon-demo-booster/'),fixture.replace('Mind a(z) 4 találat megjelenítve','Nincs találat')])assert.throws(()=>parseTcgboltPage(html));
  assert.throws(()=>parseTcgboltPage(multi(1),2));assert.throws(()=>parseTcgboltPage(multi(1).replace('class="next page-numbers"','class="unknown page-numbers"')));assert.throws(()=>parseTcgboltPage(multi(1).replaceAll('page/2/','page/3/')));
});
test('TCG Bolt URL policy admits only robots and category pagination; no cross-origin, cart, queries, API or product requests',()=>{
  for(const url of [TCGBOLT_URL,TCGBOLT_URL+'page/1/',TCGBOLT_URL+'page/50/','https://tcgbolt.hu/robots.txt']){assert.equal(tcgboltFetchUrl(url).href,url);assert.equal(shopFetchUrl(url).href,url);}
  for(const url of [TCGBOLT_URL+'?add-to-cart=1001',TCGBOLT_URL+'?orderby=price',TCGBOLT_URL+'page/0/',TCGBOLT_URL+'page/01/',TCGBOLT_URL+'page/51/',TCGBOLT_URL+'#x',TCGBOLT_URL.replace('https://','https://u:p@'),'https://other.example/robots.txt','https://tcgbolt.hu/robots.txt?x=1','https://tcgbolt.hu/wp-json/wc/store/products','https://tcgbolt.hu/wp-admin/admin-ajax.php','https://tcgbolt.hu/kosar/','https://tcgbolt.hu/bolt/demo/'])assert.throws(()=>tcgboltFetchUrl(url));
  for(const url of ['javascript:alert(1)','https://other.example/bolt/demo/','https://u:p@tcgbolt.hu/bolt/demo/','/kosar/','/bolt/demo/?add-to-cart=1','/bolt/demo/#x'])assert.throws(()=>tcgboltProductUrl(url));
});
test('TCG Bolt scans every page with robots delay, unique IDs and head recheck; never requests cart/product/image/Quick View',async()=>{
  const requests:string[]=[],waits:number[]=[];const scan=await scanTcgbolt(new AbortController().signal,{download:async url=>{requests.push(url);tcgboltFetchUrl(url);return url.endsWith('/robots.txt')?robots:url.endsWith('/page/2/')?multi(2):multi(1);},wait:async ms=>{waits.push(ms);}});
  assert.equal(scan.total,31);assert.equal(scan.pages,2);assert.equal(new Set(scan.products.map(p=>p.externalID)).size,31);assert.deepEqual(requests,['https://tcgbolt.hu/robots.txt',TCGBOLT_URL,TCGBOLT_URL+'page/2/',TCGBOLT_URL]);assert.deepEqual(waits,[1500,1500,1500]);
  const single=await scanTcgbolt(new AbortController().signal,{download:async url=>url.endsWith('/robots.txt')?robots:fixture,wait:async()=>{}});assert.equal(single.pages,1);assert.equal(single.total,2);
});
test('TCG Bolt rejects changed counts/head, duplicates across pages, blocked/invalid robots, truncated pages and abort',async()=>{
  for(const bad of [multi(2,32),multi(2).replaceAll('1031','1001'),multi(2).replace(/<li class="product[\s\S]*?<\/li>/,'')])await assert.rejects(scanTcgbolt(new AbortController().signal,{download:async url=>url.endsWith('/robots.txt')?robots:url.endsWith('/page/2/')?bad:multi(1),wait:async()=>{}}));
  let headRequests=0;await assert.rejects(scanTcgbolt(new AbortController().signal,{download:async url=>url.endsWith('/robots.txt')?robots:url.endsWith('/page/2/')?multi(2):++headRequests===1?multi(1):multi(1).replace('Pokémon Demo Booster','Changed Booster'),wait:async()=>{}}));
  for(const source of ['<html>Error</html>','Error: robots unavailable','User-agent: *\nDisallow: /termekkategoria/','User-agent: *\nDisallow: /termekkategoria/pokemon/page/2/'])await assert.rejects(scanTcgbolt(new AbortController().signal,{download:async url=>url.endsWith('/robots.txt')?source:url.endsWith('/page/2/')?multi(2):multi(1),wait:async()=>{}}));
  const abort=new AbortController();abort.abort();await assert.rejects(scanTcgbolt(abort.signal,{download:async()=>robots,wait:async()=>{}}));
});
test('TCG Bolt is an independent three-minute shop with silent baseline, named push/events and failure/settings/history preservation',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);const products=parseTcgboltPage(fixture).products;
  const run=(list:typeof products,now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='tcgbolt'").run(now);return finishScan(db,claimScan(db,now,'tcgbolt')!,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
  try{
    assert.equal(SHOP_NAMES.tcgbolt,'TCG Bolt');assert.ok(SHOP_IDS.includes('tcgbolt'));
    db.exec("DELETE FROM pokemon_user_notifications WHERE shop_id='tcgbolt';DELETE FROM pokemon_shops WHERE id='tcgbolt';UPDATE pokemon_shops SET enabled=0,interval_minutes=25,baseline_at=1000 WHERE id='gamerunner'");const ids=SHOP_IDS.filter(id=>id!=='tcgbolt'),before=ids.map(id=>shop(db,id));registerTestPhone(db);const phones=JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all());initializeDatabase(db);
    assert.deepEqual(ids.map(id=>shop(db,id)),before);assert.equal(JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),phones);assert.equal(shop(db,'tcgbolt').interval_minutes,3);assert.equal(shop(db,'tcgbolt').url,TCGBOLT_URL);
    assert.equal(run(products,1000).baseline,true);assert.equal(readPokemonSnapshot(db).latestEvents.length,0);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);assert.equal(run(products,700_000).events,0);
    assert.equal(run([...products,{...products[0],externalID:'NEW'}],1400_000).events,1);assert.equal(readPokemonSnapshot(db,false,1500_000).latestEvents[0].shop_name,'TCG Bolt');assert.match(pushForShop(db,'tcgbolt').data.title,/^TCG Bolt/);assert.equal(pushForShop(db,'tcgbolt').data.path,'/pokemon#shop-tcgbolt');cancelShopPush(db,'gamerunner');assert.equal(pushForShop(db,'tcgbolt').state,'queued');
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='tcgbolt'");failScan(db,claimScan(db,1500_001,'tcgbolt')!,'Incomplete catalog',0,1500_002);assert.equal(shop(db,'tcgbolt').last_count,3);const preserved=shop(db,'tcgbolt');initializeDatabase(db);assert.deepEqual(shop(db,'tcgbolt'),preserved);assert.deepEqual(ids.map(id=>shop(db,id)),before);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
