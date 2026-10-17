import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {lookup} from 'node:dns/promises';
import {parseAlzaPage,scanAlza,alzaProductUrl} from '../lib/pokemon/adapters/alza.ts';
import {alzaFetchUrl,shopFetchUrl,ShopRequestError} from '../lib/pokemon/fetch-policy.ts';
import {alzaResourceAllowed,alzaResolverRules,alzaBrowserHeadless,checkAlzaStatus,type AlzaDocument,type AlzaSession} from '../lib/pokemon/alza-browser.ts';
import {ALZA_URL,SHOP_IDS,SHOP_NAMES} from '../lib/pokemon/types.ts';
import {initializeDatabase} from '../lib/db-schema.ts';
import {shop,claimScan,finishScan,failScan} from '../lib/pokemon/store.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {registerTestPhone,pushForShop} from './helpers/push.ts';

const fixture=readFileSync(new URL('./fixtures/pokemon/alza/catalog.html',import.meta.url),'utf8');
type FixtureOptions={html?:string;visibility?:Record<string,boolean>;failure?:Error;url?:string};
function harness(options:FixtureOptions={}){
  const requests:string[]=[];let closed=0;
  const open=async():Promise<AlzaSession>=>({close:async()=>{closed++;},read:async(url:string):Promise<AlzaDocument>=>{
    requests.push(url);if(options.failure)throw options.failure;
    return {url:options.url??url,html:options.html??fixture,cartVisibility:options.visibility??{'1001':true,'1002':true}};
  }});
  return {requests,closed:()=>closed,options:{open}};
}
test('Alza mobile parser validates filtered count, stable ID/link/cart identity, HUF and accessories',()=>{
  const result=parseAlzaPage(fixture);assert.equal(result.total,2);assert.deepEqual(result.cardIDs,['1001','1002']);assert.equal(result.products.length,2);
  assert.deepEqual(result.products.map(product=>[product.externalID,product.sku,product.priceHuf,product.availability]),[['1001','1001',2290,'in_stock'],['1002','1002',3890,'in_stock']]);
  assert.equal(result.products[0].image,'https://image.alza.cz/products/DEMO/DEMO.jpg');assert.equal(result.products[1].title,'Pokémon Demo Album');
  assert.equal(parseAlzaPage(fixture.replaceAll('a18879069.htm?availabilityFilterValue=2','a18879069.htm')).total,2);
  assert.equal(parseAlzaPage(fixture.replace('2 290 Ft','€20')).products[0].priceHuf,null);
  assert.equal(parseAlzaPage(fixture.replace('https://image.alza.cz/','https://evil.example/')).products[0].image,null);
  for(const attrs of ['disabled','hidden','aria-disabled="true"','style="display:none"','style="visibility:hidden"'])assert.deepEqual(parseAlzaPage(fixture.replace('class="item__buy-btn js-buy"',attrs+' class="item__buy-btn js-buy"')).products.map(product=>product.externalID),['1002']);
});
test('Alza refuses desktop schema, wrong filter/category/count, ambiguous cards, unconfirmed empty and actual/unsafe pagination',()=>{
  const bad=[
    fixture.replace('id="categoryPage"','id="other"'),fixture.replace('Pokémon kártyák</h1>','Játékok</h1>'),fixture.replace('availabilityFilterValue=2','availabilityFilterValue=1'),fixture.replace('button-filter__count">1','button-filter__count">0'),
    fixture.replace('commodity-count--bold">2','commodity-count--bold">3'),fixture.replace('commodity-count--bold">2','commodity-count--bold">0'),fixture.replace('ennyiből: 208','ennyiből: 1'),
    fixture.replaceAll('1002','1001'),fixture.replace('data-id="1001"><svg>','data-id="9999"><svg>'),fixture.replace('Raktáron &gt; 10 db','Nincs raktáron'),fixture.replace('item__name">Pokémon Demo Booster','other">Pokémon Demo Booster'),
    fixture.replace('class="js-box item"','class="box"'),fixture.replace('Kosárba</button>','Érdeklődj</button>'),fixture.replace('pokemon-demo-booster-d1001.htm','pokemon-demo-booster-d9999.htm'),fixture.replaceAll('https://m.alza.hu/jatekok/pokemon-demo','https://evil.example/jatekok/pokemon-demo'),
    fixture.replaceAll('a18879069.htm','18879069-p2.htm?availabilityFilterValue=2'),fixture.replaceAll('a18879069.htm?availabilityFilterValue=2','a18879069.htm?availabilityFilterValue=1'),fixture.replace('Archív</span>','Tovább</span>'),fixture.replace('rel="next"','rel="prev"'),fixture.replace('</div>\n<\/div>\n<div class="panel','</div><div>Loading…</div>\n</div>\n<div class="panel')
  ];
  for(const html of bad)assert.throws(()=>parseAlzaPage(html));
  assert.throws(()=>parseAlzaPage('<html><title>CAPTCHA</title></html>'),(error:unknown)=>error instanceof ShopRequestError&&error.kind==='protected');
});
test('Alza navigation/product policies reject desktop/API/cart/archive/foreign/credentials/duplicates and arbitrary pages',()=>{
  assert.equal(alzaFetchUrl(ALZA_URL).href,ALZA_URL);assert.equal(shopFetchUrl(ALZA_URL).href,ALZA_URL);
  for(const url of [ALZA_URL+'&pg=2',ALZA_URL+'&availabilityFilterValue=2',ALZA_URL+'#x',ALZA_URL.replace('=2','=1'),ALZA_URL.replace('m.alza','www.alza'),ALZA_URL.replace('https:','http:'),'https://m.alza.hu/robots.txt','https://m.alza.hu:444/robots.txt','https://u:p@m.alza.hu/robots.txt','https://m.alza.hu/robots.txt?x=1','https://m.alza.hu/Services/EShopService.svc/Filter','https://m.alza.hu/jatekok/pokemon-kartyak/a18879069.htm','https://m.alza.hu/kosar'])assert.throws(()=>alzaFetchUrl(url));
  for(const url of ['javascript:alert(1)','https://evil.example/jatekok/demo-d1001.htm','https://u:p@m.alza.hu/jatekok/demo-d1001.htm','/jatekok/demo-d1002.htm','/jatekok/demo-d1001.htm?cart=1','/jatekok/demo-d1001.htm#x'])assert.throws(()=>alzaProductUrl(url,'1001'));
});
test('Alza browser subresources are static HTTPS assets only; no tracking, private network, APIs, cart or writes',()=>{
  assert.ok(alzaResourceAllowed(ALZA_URL,'GET','document'));
  assert.ok(alzaResourceAllowed('https://cdn.alza.cz/js/app.js','GET','script'));
  assert.ok(alzaResourceAllowed('https://image.alza.cz/products/DEMO/DEMO.jpg','GET','image'));
  for(const [url,method,type]of [[ALZA_URL,'POST','document'],['https://m.alza.hu/kosar','GET','image'],['https://m.alza.hu/api/catalog','GET','fetch'],['https://webapi.alza.cz/api/catalog','GET','xhr'],['http://cdn.alza.cz/app.js','GET','script'],['https://u:p@cdn.alza.cz/app.js','GET','script'],['https://cdn.alza.cz:444/app.js','GET','script'],['https://127.0.0.1/','GET','document'],['https://evil.example/app.js','GET','script'],['https://cdn.alza.cz/app.js','GET','websocket']])assert.equal(alzaResourceAllowed(url,method,type),false);
});
test('Alza DNS is pinned for all approved browser hosts and rejects private/mixed DNS without launching a browser',async()=>{
  const resolver=(async()=>[{address:'93.184.216.34',family:4}]) as unknown as typeof lookup;
  const rules=await alzaResolverRules(resolver);assert.match(rules,/MAP m\.alza\.hu 93\.184\.216\.34/);assert.ok(rules.endsWith('MAP * ~NOTFOUND'));
  for(const addresses of [[],[{address:'127.0.0.1',family:4}],[{address:'93.184.216.34',family:4},{address:'192.168.0.1',family:4}],[{address:'::1',family:6}]])await assert.rejects(alzaResolverRules((async()=>addresses) as unknown as typeof lookup));
  const abort=new AbortController();abort.abort();await assert.rejects(alzaResolverRules(resolver,abort.signal));
});
test('Alza HTTP rejection preserves protected/rate-limited classification and Retry-After',()=>{
  assert.equal(alzaBrowserHeadless('headless'),true);assert.equal(alzaBrowserHeadless('headed'),false);assert.throws(()=>alzaBrowserHeadless('stealth'));
  checkAlzaStatus(200);
  for(const [status,kind]of [[403,'protected'],[429,'rate_limited'],[503,'error']] as const)assert.throws(()=>checkAlzaStatus(status,'900'),(error:unknown)=>error instanceof ShopRequestError&&error.kind===kind&&error.retryAfterMs===900000);
});
test('Alza scans the stock category exactly once without robots per owner instruction, proves visibility and always closes',async()=>{
  const h=harness({visibility:{'1001':true,'1002':false}}),result=await scanAlza(new AbortController().signal,h.options);
  assert.equal(result.total,1);assert.equal(result.pages,1);assert.equal(result.products[0].externalID,'1001');assert.deepEqual(h.requests,[ALZA_URL]);assert.equal(h.closed(),1);
});
test('Alza scan fails closed on incomplete DOM/visibility/redirect/403 and closes on abort without saving anything',async()=>{
  const failures:FixtureOptions[]=[{html:fixture.replace('commodity-count--bold">2','commodity-count--bold">3')},{visibility:{'1001':true}},{visibility:{'1001':false,'1002':false}},{url:ALZA_URL.replace('=2','=1')},{failure:new ShopRequestError('HTTP 403',0,'protected')}];
  for(const options of failures){
    const h=harness(options);await assert.rejects(scanAlza(new AbortController().signal,h.options));assert.equal(h.closed(),1);
  }
  const pre=new AbortController();pre.abort();const h=harness();await assert.rejects(scanAlza(pre.signal,h.options));assert.deepEqual(h.requests,[]);assert.equal(h.closed(),0);
  const abort=new AbortController(),mid=harness();await assert.rejects(scanAlza(abort.signal,{open:async()=>{abort.abort();return mid.options.open();}}));assert.equal(mid.closed(),1);assert.equal(mid.requests.length,0);
});
test('Alza initializes paused without modifying existing shops/settings/pairings; baseline is silent, later new/restock pushes are isolated',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);const products=parseAlzaPage(fixture).products;
  try{
    assert.equal(SHOP_NAMES.alza,'Alza');assert.equal(shop(db,'alza').enabled,0);assert.equal(shop(db,'alza').status,'paused');assert.equal(shop(db,'alza').url,ALZA_URL);assert.equal(claimScan(db,1000,'alza'),null);
    db.exec("DELETE FROM pokemon_user_notifications WHERE shop_id='alza';DELETE FROM pokemon_shops WHERE id='alza';UPDATE pokemon_shops SET interval_minutes=8 WHERE id='mythgames'");registerTestPhone(db);
    const ids=SHOP_IDS.filter(id=>id!=='alza'),before=ids.map(id=>shop(db,id)),phones=JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),preferences=JSON.stringify(db.prepare("SELECT * FROM pokemon_user_notifications WHERE shop_id!='alza'").all());initializeDatabase(db);
    assert.deepEqual(ids.map(id=>shop(db,id)),before);assert.equal(JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),phones);assert.equal(JSON.stringify(db.prepare("SELECT * FROM pokemon_user_notifications WHERE shop_id!='alza'").all()),preferences);
    db.exec("UPDATE pokemon_shops SET enabled=1 WHERE id='alza'");
    const run=(list:typeof products,now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='alza'").run(now);return finishScan(db,claimScan(db,now,'alza')!,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
    assert.equal(run(products.slice(0,1),1000).baseline,true);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);
    assert.equal(run(products,700000).events,1);assert.match(pushForShop(db,'alza').data.title,/^Alza/);assert.equal(pushForShop(db,'alza').data.path,'/pokemon#shop-alza');assert.equal(JSON.parse(pushForShop(db,'alza').payload).productUrl,products[1].url);assert.equal(readPokemonSnapshot(db,false,700002).latestEvents[0].shop_name,'Alza');
    assert.equal(run(products.slice(0,1),1400000).events,0);assert.equal(run(products.slice(0,1),2100000).events,0);assert.equal(run(products,2800000).events,1);
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='alza'");const savedProducts=db.prepare("SELECT * FROM pokemon_products WHERE shop_id='alza'").all();failScan(db,claimScan(db,3500000,'alza')!,'Hozzáférésvédelem',0,3500001,'protected');assert.deepEqual(db.prepare("SELECT * FROM pokemon_products WHERE shop_id='alza'").all(),savedProducts);assert.equal(shop(db,'alza').last_count,2);assert.equal(shop(db,'alza').status,'protected');
    const saved=shop(db,'alza');initializeDatabase(db);assert.deepEqual(shop(db,'alza'),saved);assert.deepEqual(ids.map(id=>shop(db,id)),before);assert.equal(JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),phones);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
