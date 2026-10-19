import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {load} from 'cheerio';
import {parseMetagamesPage,scanMetagames,metagamesProductUrl} from '../lib/pokemon/adapters/metagames.ts';
import {metagamesFetchUrl,shopFetchUrl} from '../lib/pokemon/fetch-policy.ts';
import {METAGAMES_URL,SHOP_IDS} from '../lib/pokemon/types.ts';
import {initializeDatabase} from '../lib/db-schema.ts';
import {claimScan,finishScan,failScan,shop} from '../lib/pokemon/store.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {registerTestPhone,pushForShop} from './helpers/push.ts';
import {cancelShopPush} from '../lib/mobile/store.ts';
const fixture=readFileSync(new URL('./fixtures/pokemon/metagames/catalog.html',import.meta.url),'utf8');
function page(index:number,last:number,ids:number[]){
  const $=load(fixture),template=$('.row > .col').first().clone();$('.row').empty();
  for(const id of ids){const card=template.clone();card.find('.webshop-list-item-name a').attr('href','/gyujtogetos-kartyajatekok/pokemon-tcg/example-pid'+id).text('Example '+id);card.find('button').attr('id','buy'+id);$('.row').append(card);}
  $('nav').each((_,el)=>{const nav=$(el);nav.empty();for(const [title,value,text]of [['Go to first page',0,'<<'],['Go to previous page',Math.max(0,index-1),'<'],...Array.from({length:last+1},(_,n)=>['Go to page '+(n+1),n,String(n+1)]),['Go to next page',Math.min(last,index+1),'>'],['Go to last page',last,'>>']])nav.append($('<a>').attr('title',String(title)).attr('href',METAGAMES_URL+'&page='+value).text(String(text)));});
  return $.html();
}
const firstIds=Array.from({length:12},(_,n)=>3000+n),first=page(0,1,firstIds),last=page(1,1,[4000,4001]);
test('Metagames: selected stock filter, stable IDs, active cart buttons, HUF prices and safe images',()=>{
  const parsed=parseMetagamesPage(fixture);assert.deepEqual(parsed.cardIDs,['2001','2002']);assert.equal(parsed.lastPage,0);assert.equal(parsed.products.length,2);
  assert.equal(parsed.products[0].priceHuf,1000);assert.equal(parsed.products[1].priceHuf,12990);assert.ok(parsed.products.every(p=>p.availability==='in_stock'));assert.match(parsed.products[0].image!,/^https:\/\/www.metagames.hu\/thumb\//);
  assert.equal(parseMetagamesPage(fixture.replace('id="buy2001"','id="buy2001" disabled')).products.length,1);
  assert.equal(parseMetagamesPage(fixture.replace('1&nbsp;000 Ft','Unknown')).products[0].priceHuf,null);
  assert.equal(parseMetagamesPage(fixture.replace('/upload/images/2026_10/example.png','/upload/images/../secret')).products[0].image,null);
});
test('Metagames: preorder requires matching preOrder ID and explicit preorder stock label, retaining mixed catalog identity',async()=>{
  const $=load(fixture),card=$('#buy2001').closest('.card');
  card.find('#buy2001').attr('id','preOrder2001');
  card.find('.text-success.font-weight-bold').removeClass('text-success').addClass('text-danger').html('Előrendelhető <small>(2026.11.09)</small>');
  const html=$.html(),parsed=parseMetagamesPage(html);
  assert.deepEqual(parsed.cardIDs,['2001','2002']);assert.deepEqual(parsed.products.map(p=>p.availability),['preorder','in_stock']);
  assert.equal(parsed.products[0].priceHuf,1000);
  assert.equal(parseMetagamesPage(html.replace('id="preOrder2001"','id="preOrder2001" disabled')).products.length,1);
  for(const invalid of [html.replace('preOrder2001','preOrder9999'),html.replace('preOrder2001','buy2001'),fixture.replace('buy2001','preOrder2001'),html.replace('Előrendelhető','Ismeretlen'),html.replace('text-danger','text-success'),html.replace('id="preOrder2001"','id="preOrder2001"><button id="buy2001"')])assert.throws(()=>parseMetagamesPage(invalid));
  const result=await scanMetagames(new AbortController().signal,{download:async url=>url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':html,wait:async()=>{}});
  assert.equal(result.total,2);assert.equal(result.products[0].availability,'preorder');
});
test('Metagames: both observed English and Hungarian navigation labels validate the same pagination',()=>{
  const hu=fixture.replaceAll('Go to first page','Ugrás az első oldalra').replaceAll('Go to previous page','Ugrás az előző oldalra').replaceAll('Go to next page','Ugrás a következő oldalra').replaceAll('Go to last page','Ugrás az utolsó oldalra').replaceAll('Go to page 1','Ugrás a(z) 1 oldalra');
  assert.deepEqual(parseMetagamesPage(hu),parseMetagamesPage(fixture));
});
test('Metagames: wrong filter/category/size, missing navigation/cart, unsafe or mismatched IDs and unknown stock fail closed',()=>{
  for(const html of [fixture.replace('value="true" selected','value="false" selected'),fixture.replace('<h1>Pokémon TCG</h1>','<h1>Other</h1>'),fixture.replace('selected="selected">12','selected="selected">24'),fixture.replace('class="pagination"','class="missing"'),fixture.replace('id="buy2001"','id="buy9999"'),fixture.replace('Kosárba','Értesítés'),fixture.replace('Készleten</div>','Előrendelhető</div>'),fixture.replaceAll('2002','2001'),fixture.replace('https://www.metagames.hu/','https://other.example/').replace('/pokemon-booster-pid2001','/pokemon-booster-pid2001?buy=1')])assert.throws(()=>parseMetagamesPage(html));
  assert.throws(()=>parseMetagamesPage(page(0,1,[3000])));assert.throws(()=>parseMetagamesPage(page(0,0,[])));assert.throws(()=>parseMetagamesPage(page(0,2,firstIds),1));
});
test('Metagames: fetch allowlist accepts only category stock/pagination and robots, never cart/listener/action URLs',()=>{
  for(const url of [METAGAMES_URL,METAGAMES_URL+'&page=0',METAGAMES_URL+'&page=49','https://www.metagames.hu/robots.txt']){assert.equal(metagamesFetchUrl(url).href,url);assert.equal(shopFetchUrl(url).href,url);}
  for(const url of [METAGAMES_URL.replace('csak-keszleten','all'),METAGAMES_URL+'&page=',METAGAMES_URL+'&page=-1',METAGAMES_URL+'&page=50',METAGAMES_URL+'&page=01',METAGAMES_URL+'&page=1&page=1',METAGAMES_URL+'&keszlet=csak-keszleten',METAGAMES_URL+'&ajax=1',METAGAMES_URL+'&IBehaviorListener=1',METAGAMES_URL+'#x',METAGAMES_URL.replace('https://','https://u:p@'),'https://www.metagames.hu/robots.txt?x=1','https://www.metagames.hu/kosar/','https://www.metagames.hu/wicket/bookmarkable/cart','https://other.example/robots.txt'])assert.throws(()=>metagamesFetchUrl(url));
  for(const url of ['javascript:alert(1)','https://other.example/example-pid1','https://www.metagames.hu/kosar/','/gyujtogetos-kartyajatekok/pokemon-tcg/example-pid1?buy=1','/gyujtogetos-kartyajatekok/pokemon-tcg/example-pid1#x'])assert.throws(()=>metagamesProductUrl(url));
});
test('Metagames: complete zero-based multi-page scan with first/last checkpoints, robots and polite waits',async()=>{
  const requests:string[]=[],waits:number[]=[];const result=await scanMetagames(new AbortController().signal,{download:async url=>{requests.push(url);metagamesFetchUrl(url);return url.endsWith('/robots.txt')?'User-agent: *\nAllow: /\nCrawl-delay: 2':url.includes('page=1')?last:first;},wait:async ms=>{waits.push(ms);}});
  assert.equal(result.pages,2);assert.equal(result.total,14);assert.equal(new Set(result.products.map(p=>p.externalID)).size,14);
  assert.deepEqual(requests,['https://www.metagames.hu/robots.txt',METAGAMES_URL,METAGAMES_URL+'&page=1',METAGAMES_URL+'&page=1',METAGAMES_URL]);assert.ok(waits.every(ms=>ms>=2000));
  const single=await scanMetagames(new AbortController().signal,{download:async url=>url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':fixture,wait:async()=>{}});assert.equal(single.total,2);assert.equal(single.pages,1);
});
test('Metagames: forbidden/malformed robots, changed pagination/boundary IDs, duplicate or incomplete pages abort',async()=>{
  for(const robot of ['User-agent: *\nDisallow: /','<html>Challenge</html>'])await assert.rejects(scanMetagames(new AbortController().signal,{download:async()=>robot,wait:async()=>{}}));
  for(const mode of ['bound','duplicate','partial','lastChanged','headChanged']){
    let headReads=0,lastReads=0;
    await assert.rejects(scanMetagames(new AbortController().signal,{download:async url=>{
      if(url.endsWith('/robots.txt'))return 'User-agent: *\nAllow: /';
      if(url.includes('page=1')){lastReads++;if(mode==='bound')return page(1,2,firstIds);if(mode==='duplicate')return page(1,1,[3000,4000]);if(mode==='partial')return last.replace('class="pagination"','class="missing"');if(mode==='lastChanged'&&lastReads>1)return page(1,1,[4000,4002]);return last;}
      headReads++;return mode==='headChanged'&&headReads>1 ? page(0,1,[...firstIds.slice(1),3000]) : first;
    },wait:async()=>{}}));
  }
  const abort=new AbortController();abort.abort();await assert.rejects(scanMetagames(abort.signal,{download:async()=> 'User-agent: *\nAllow: /',wait:async()=>{}}));
});
test('Metagames: additive shop migration, silent baseline, named new-product push, failure preservation and scoped settings',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);const products=parseMetagamesPage(fixture).products;
  const run=(list:typeof products,now:number)=>{db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='metagames'").run(now);return finishScan(db,claimScan(db,now,'metagames')!,{products:list,total:list.length,pages:1,scannedAt:now},now+1);};
  try{
    db.exec("DELETE FROM pokemon_user_notifications WHERE shop_id='metagames';DELETE FROM pokemon_shops WHERE id='metagames';UPDATE pokemon_shops SET enabled=0,interval_minutes=25,baseline_at=1000 WHERE id='gamerunner'");const previous=SHOP_IDS.filter(id=>id!=='metagames').map(id=>shop(db,id));registerTestPhone(db);
    const phoneBefore=JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all());initializeDatabase(db);assert.deepEqual(SHOP_IDS.filter(id=>id!=='metagames').map(id=>shop(db,id)),previous);assert.equal(JSON.stringify(db.prepare('SELECT * FROM mobile_devices').all()),phoneBefore);assert.equal(shop(db,'metagames').interval_minutes,3);
    assert.equal(run(products,1000).baseline,true);assert.equal(readPokemonSnapshot(db).latestEvents.length,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM mobile_push_outbox').get()!.n,0);
    run([...products,{...products[0],externalID:'NEW'}],700_000);assert.equal(readPokemonSnapshot(db,false,800_000).latestEvents[0].shop_name,'Metagames');assert.match(pushForShop(db,'metagames').data.title,/^Metagames/);assert.equal(pushForShop(db,'metagames').data.path,'/pokemon#shop-metagames');
    cancelShopPush(db,'gamerunner');assert.equal(pushForShop(db,'metagames').state,'queued');db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='metagames'");failScan(db,claimScan(db,800_001,'metagames')!,'Incomplete list',0,800_002);assert.equal(shop(db,'metagames').last_count,3);
    const preserved=shop(db,'metagames');initializeDatabase(db);assert.deepEqual(shop(db,'metagames'),preserved);assert.deepEqual(SHOP_IDS.filter(id=>id!=='metagames').map(id=>shop(db,id)),previous);
  }finally{db.close();}
});
