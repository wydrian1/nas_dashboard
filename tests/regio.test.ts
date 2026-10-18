import test from 'node:test';
import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
import {DatabaseSync} from 'node:sqlite';
import {regioFixture} from './fixtures/pokemon/regio/catalog.ts';
import {parseRegioPage,scanRegio,regioImageUrl,regioProductUrl} from '../lib/pokemon/adapters/regio.ts';
import {regioResourceAllowed,regioSearchRequestUrl,regioResolverRules,checkRegioStatus,REGIO_SEARCH_BOX,type RegioSession} from '../lib/pokemon/regio-browser.ts';
import {regioFetchUrl,shopFetchUrl,ShopRequestError} from '../lib/pokemon/fetch-policy.ts';
import {REGIO_URL,REGIO_FILTER,SHOP_IDS} from '../lib/pokemon/types.ts';
import {initializeDatabase} from '../lib/db-schema.ts';
import {shop,claimScan,finishScan,failScan} from '../lib/pokemon/store.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {registerTestPhone,pushForShop} from './helpers/push.ts';

const fixture=regioFixture(),uuid='11111111-1111-1111-1111-111111111111';
function searchUrl(){const url=new URL('https://api.prefixbox.com/search/results/');url.search=new URLSearchParams({btr:REGIO_SEARCH_BOX,filter:REGIO_FILTER,orderby:'',top:'30',page:'1',useMerchandising:'true',pattern:'pokemon',userId:uuid,sessionId:uuid,customParams:JSON.stringify([{name:'UserId',values:[uuid]},{name:'SessionId',values:[uuid]}])}).toString();return url;}
test('REGIO accepts only the requested card search and observed public read-only search endpoint; no robots',()=>{
  assert.equal(regioFetchUrl(REGIO_URL).href,REGIO_URL);assert.equal(shopFetchUrl(REGIO_URL).href,REGIO_URL);
  for(const input of [REGIO_URL+'&page=2',REGIO_URL+'&query=pokemon',REGIO_URL.replace('query=pokemon','query=lego'),REGIO_URL.replace('ws_action=search','ws_action=cart'),REGIO_URL.replace('K%C3%A1rtya','LEGO'),REGIO_URL.replace('www.regiojatek.hu','regiojatek.hu'),REGIO_URL+'#x','https://www.regiojatek.hu/robots.txt','http://www.regiojatek.hu/index.php'])assert.throws(()=>regioFetchUrl(input));
  assert.equal(regioSearchRequestUrl(searchUrl().href).href,searchUrl().href);
  for(const [key,value]of [['btr',uuid],['filter',"category eq 'LEGO'"],['page','2'],['top','600'],['pattern','lego'],['orderby','price'],['userId','x'],['customParams','[]'],['unknown','x']]){const url=searchUrl();url.searchParams.set(key,value);assert.throws(()=>regioSearchRequestUrl(url.href));}
  const duplicate=searchUrl();duplicate.searchParams.append('page','1');assert.throws(()=>regioSearchRequestUrl(duplicate.href));
  assert.ok(regioResourceAllowed(searchUrl().href,'GET','fetch'));assert.ok(regioResourceAllowed(REGIO_URL,'GET','document'));assert.ok(regioResourceAllowed('https://www.regiojatek.hu/assets/images/icon.svg','GET','fetch'));
  for(const [url,method,type]of [[REGIO_URL,'POST','document'],['https://www.regiojatek.hu/index.php?action=cart','GET','fetch'],[searchUrl().href,'POST','fetch'],['https://api.prefixbox.com/relatedsearches/products','GET','fetch'],['https://www.regiojatek.hu/metrics/test.js','GET','script'],['https://evil.example/app.js','GET','script'],['https://127.0.0.1/private','GET','fetch'],['https://www.regiojatek.hu/assets/js/a.js','GET','websocket']])assert.equal(regioResourceAllowed(url,method,type),false);
});
test('REGIO proves response query/category/count, full lazy DOM, stable zero-prefixed identity, cart, HUF and images',()=>{
  const parsed=parseRegioPage(fixture.html,fixture.api);assert.equal(parsed.total,2);assert.equal(parsed.products.length,2);assert.equal(parsed.products[0].externalID,'00101');assert.equal(parsed.products[0].sku,'00101');assert.equal(parsed.products[0].priceHuf,2995);assert.equal(parsed.products[0].image,fixture.api.documents[0].document.imageUrl);assert.equal(parsed.products[0].availability,'in_stock');
  const inactive=regioFixture(2,'out of stock');assert.equal(parseRegioPage(inactive.html,inactive.api).products.length,0);
  const orderOnly=regioFixture(2,'available for order');assert.equal(parseRegioPage(orderOnly.html,orderOnly.api).products.length,0);
  const promoted=structuredClone(fixture.api);promoted.documents[1].document.displayText='Demo kártyajáték';const promotedHtml=fixture.html.replaceAll('Pokémon Demo 2','Demo kártyajáték');const mixed=parseRegioPage(promotedHtml,promoted);assert.equal(mixed.products.length,1);assert.equal(mixed.cardIDs.length,2);assert.equal(mixed.total,2);
  assert.equal(parseRegioPage(fixture.html.replace('2 995 Ft','Unknown'),fixture.api).products[0].priceHuf,null);
  assert.equal(parseRegioPage(fixture.html.replace('class="add-to-cart"','hidden class="add-to-cart"'),fixture.api).products.length,1);
  assert.throws(()=>parseRegioPage(fixture.html.replaceAll('class="add-to-cart"','hidden class="add-to-cart"'),fixture.api));
  assert.equal(regioImageUrl(fixture.api.documents[0].document.imageUrl,'00102'),null);assert.throws(()=>regioProductUrl(fixture.api.documents[0].document.url,'00102'));
  for(const url of ['https://evil.example/data/regio_images/data/regio_images/preview/00101_0.webp',fixture.api.documents[0].document.imageUrl+'?x=1',fixture.api.documents[0].document.imageUrl+'#x',fixture.api.documents[0].document.imageUrl.replace('www.regiojatek.hu','u:p@www.regiojatek.hu')])assert.equal(regioImageUrl(url,'00101'),null);
});
test('REGIO never accepts unverified empty, partial/placeholder/paginated/mismatched/foreign/ambiguous data',()=>{
  const mutations=[(data:typeof fixture.api)=>{data.count=1;},(data:typeof fixture.api)=>{data.resultCount=3;},(data:typeof fixture.api)=>{data.searchParameters.query='lego';},(data:typeof fixture.api)=>{data.searchParameters.filters.termFilters[0].values=['LEGO'];},(data:typeof fixture.api)=>{data.searchParameters.page=2;},(data:typeof fixture.api)=>{data.responseDescriptor.responseStatus.responseStatusCode=1;},(data:typeof fixture.api)=>{data.documents[0].document.availability='unknown';},(data:typeof fixture.api)=>{data.documents[1].document.identifier='00101';}];
  for(const mutate of mutations){const api=structuredClone(fixture.api);mutate(api);assert.throws(()=>parseRegioPage(fixture.html,api));}
  const empty=regioFixture(0);assert.throws(()=>parseRegioPage(empty.html,empty.api));const multi=regioFixture(31);assert.throws(()=>parseRegioPage(multi.html,multi.api));
  for(const html of [fixture.html.replace('2 termék','3 termék'),fixture.html.replace(fixture.cards[1],'<div class="prefixbox-product-container-placeholder"></div>'),fixture.html.replace('data-cart-product-no="00101"','data-cart-product-no="99999"'),fixture.html.replace('id="paginator"','id="paginator"><a href="?page=2">2</a><div'),fixture.html.replace('data-cart-product-id="9001"','data-cart-product-id="9999"'),fixture.html.replace('Kosárba','Érdeklődj'),fixture.html.replace('https://www.regiojatek.hu/termek-00101','https://evil.example/termek-00101')])assert.throws(()=>parseRegioPage(html,fixture.api));
});
test('REGIO public DNS pinning, abort and HTTP protection/rate limits fail closed',async()=>{
  const resolve=(async()=>[{address:'93.184.216.34',family:4}]) as unknown as typeof lookup;assert.match(await regioResolverRules(resolve),/MAP \* ~NOTFOUND$/);
  for(const addresses of [[],[{address:'127.0.0.1',family:4}],[{address:'93.184.216.34',family:4},{address:'::1',family:6}]])await assert.rejects(regioResolverRules((async()=>addresses) as unknown as typeof lookup));
  const abort=new AbortController();abort.abort();await assert.rejects(regioResolverRules(resolve,abort.signal));checkRegioStatus(200);
  for(const [status,kind]of [[403,'protected'],[429,'rate_limited'],[500,'error']])assert.throws(()=>checkRegioStatus(Number(status),'900'),error=>error instanceof ShopRequestError&&error.kind===kind&&error.retryAfterMs===900000);
});
test('REGIO scanner reads once without robots, validates rendered visibility and closes on success/error/abort',async()=>{
  let reads=0,closed=0;const open=async():Promise<RegioSession>=>({read:async()=>{reads++;return {url:REGIO_URL,html:fixture.html,api:fixture.api,cartVisibility:{'00101':true,'00102':true}};},close:async()=>{closed++;}});
  const scan=await scanRegio(new AbortController().signal,{open});assert.equal(scan.total,2);assert.equal(scan.pages,1);assert.equal(reads,1);assert.equal(closed,1);
  const visibilityCases:Record<string,boolean>[]=[{},{'00101':true},{'00101':false,'00102':false}];
  for(const visibility of visibilityCases){const session=await open();await assert.rejects(scanRegio(new AbortController().signal,{open:async()=>({...session,read:async()=>({...await session.read(),cartVisibility:visibility})})}));}
  const abort=new AbortController();await assert.rejects(scanRegio(abort.signal,{open:async()=>{const session=await open();abort.abort();return session;}}));assert.equal(closed,5);
  const pre=new AbortController();pre.abort();await assert.rejects(scanRegio(pre.signal,{open}));assert.equal(closed,5);
});
test('REGIO paused registration preserves all shops/pairings/preferences; silent baseline, image update and isolated new/restock pushes',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);registerTestPhone(db);
  try{
    assert.equal(shop(db,'regio').enabled,0);assert.equal(shop(db,'regio').status,'paused');assert.equal(claimScan(db,1000,'regio'),null);
    const ids=SHOP_IDS.filter(id=>id!=='regio'),before=ids.map(id=>shop(db,id)),devices=db.prepare('SELECT * FROM mobile_devices').all(),preferences=db.prepare('SELECT * FROM pokemon_user_notifications').all();initializeDatabase(db);assert.deepEqual(ids.map(id=>shop(db,id)),before);assert.deepEqual(db.prepare('SELECT * FROM mobile_devices').all(),devices);assert.deepEqual(db.prepare('SELECT * FROM pokemon_user_notifications').all(),preferences);
    db.exec("UPDATE pokemon_shops SET enabled=1 WHERE id='regio'");const products=parseRegioPage(fixture.html,fixture.api).products;
    const run=(list:typeof products,now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='regio'").run(now);return finishScan(db,claimScan(db,now,'regio')!,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
    assert.equal(run([{...products[0],image:null}],1000).baseline,true);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);
    const baseline=shop(db,'regio').baseline_at,identity=db.prepare("SELECT external_id,first_seen,episode FROM pokemon_products WHERE shop_id='regio'").all();
    assert.equal(run(products.slice(0,1),350000).events,0);assert.equal(db.prepare("SELECT image FROM pokemon_products WHERE shop_id='regio'").get()!.image,products[0].image);assert.equal(shop(db,'regio').baseline_at,baseline);assert.deepEqual(db.prepare("SELECT external_id,first_seen,episode FROM pokemon_products WHERE shop_id='regio'").all(),identity);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);
    assert.equal(run(products,700000).events,1);assert.match(pushForShop(db,'regio').data.title,/^REGIO JÁTÉK/);assert.equal(JSON.parse(pushForShop(db,'regio').payload).productUrl,products[1].url);assert.equal(readPokemonSnapshot(db,false,700002).latestEvents[0].shop_name,'REGIO JÁTÉK');
    assert.equal(run(products,1400000).events,0);run(products.slice(0,1),2100000);run(products.slice(0,1),2800000);assert.equal(run(products,3500000).events,1);
    const saved=db.prepare("SELECT * FROM pokemon_products WHERE shop_id='regio'").all();db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='regio'");failScan(db,claimScan(db,4200000,'regio')!,'Synthetic protection',0,4200001,'protected');assert.deepEqual(db.prepare("SELECT * FROM pokemon_products WHERE shop_id='regio'").all(),saved);
    const settings=shop(db,'regio');initializeDatabase(db);assert.deepEqual(shop(db,'regio'),settings);assert.deepEqual(ids.map(id=>shop(db,id)),before);assert.deepEqual(db.prepare('SELECT * FROM mobile_devices').all(),devices);assert.deepEqual(db.prepare('SELECT * FROM pokemon_user_notifications').all(),preferences);
  }finally{db.close();}
});
