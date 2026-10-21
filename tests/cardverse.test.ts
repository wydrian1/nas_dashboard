import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {load} from 'cheerio';
import {initializeDatabase} from '../lib/db-schema.ts';
import {shop} from '../lib/pokemon/store.ts';
import {CARDVERSE_URL} from '../lib/pokemon/types.ts';
import {cardverseFetchUrl} from '../lib/pokemon/fetch-policy.ts';
import {parseCardversePage,scanCardverse} from '../lib/pokemon/adapters/cardverse.ts';
const fixture=readFileSync(new URL('./fixtures/pokemon/cardverse/catalog.html',import.meta.url),'utf8');
function page(number:number,total=2){
  const $=load(fixture),scripts=$('script');
  const http=JSON.parse(scripts.eq(0).text().match(/= (.*);/)![1]),data=JSON.parse(scripts.eq(1).text().match(/= (.*);/)![1]);
  if(number>1){http.get._paged=String(number);http.url_vars.paged=String(number);}
  data.preload_data.settings.pager={page:number,per_page:1,total_rows:total,total_pages:total};
  scripts.eq(0).text('window.FWP_HTTP = '+JSON.stringify(http)+';');scripts.eq(1).text('window.FWP_JSON = '+JSON.stringify(data)+';');
  $('article.cverse-product').eq(number===1 ? 1 : 0).remove();
  return $.html();
}
test('Cardverse paginates only category GETs; repeated, changing, partial and wrong-page results fail closed',async()=>{
  const requests:string[]=[],waits:number[]=[];
  const result=await scanCardverse(AbortSignal.timeout(5000),{download:async url=>{requests.push(url);return url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /*?*add-to-cart=' : page(url.includes('_paged=2') ? 2 : 1);},wait:async ms=>{waits.push(ms);}});
  assert.equal(result.total,2);assert.equal(result.pages,2);assert.deepEqual(result.products.map(p=>p.externalID),['4835','4754']);assert.deepEqual(requests,['https://www.cardverse.hu/robots.txt',CARDVERSE_URL,CARDVERSE_URL+'&_paged=2']);assert.ok(waits.every(ms=>ms>=1500));
  for(const second of [page(1),page(2).replaceAll('4754','4835'),page(2,3),page(2).replace('cverse-product','missing-card')])await assert.rejects(()=>scanCardverse(AbortSignal.timeout(5000),{download:async url=>url.endsWith('/robots.txt') ? 'User-agent: *' : url.includes('_paged=2') ? second : page(1),wait:async()=>{}}));
});
test('Cardverse verifies both JSON sources, checked facets, category, stock and static assignments',()=>{
  for(const html of [fixture.replace('"_brands":"pokemon-tcg"','"_brands":"digimon"'),fixture.replace('facetwp-checkbox checked','facetwp-checkbox'),fixture.replace('https://schema.org/InStock','https://schema.org/OutOfStock'),fixture.replace('stock-is-instock','stock-is-outofstock'),fixture.replace('rel="canonical"','rel="wrong"'),fixture.replace('</script>','</script><script>window.FWP_HTTP = {};</script>'),fixture.replace('window.FWP_JSON =','alert(1);window.FWP_JSON ='),fixture.replace('"brands":["pokemon-tcg"]','"brands":["pokemon-tcg","digimon"]')])assert.throws(()=>parseCardversePage(html));
  for(const url of [CARDVERSE_URL,CARDVERSE_URL+'&_paged=2',CARDVERSE_URL+'&_paged=50'])assert.equal(cardverseFetchUrl(url).href,url);
  for(const suffix of ['&_paged=1','&_paged=0','&_paged=51','&_paged=02','&_paged=2&_paged=3','&_brand=pokemon-tcg','&~1','&ajax=1','&add-to-cart=1'])assert.throws(()=>cardverseFetchUrl(CARDVERSE_URL+suffix));
});
test('Cardverse exact legacy URL migration preserves baseline, preferences and other shops',()=>{
  const db=new DatabaseSync(':memory:');try{
    initializeDatabase(db);
    db.prepare("UPDATE pokemon_shops SET url=?,baseline_at=123,last_success=456,next_scan=999999,failure_count=9,notify_preorder=0 WHERE id='cardverse'").run('https://www.cardverse.hu/termekkategoria/gyujtogetos-kartyajatekok/?_stock=instock&_cat=gyujtogetos-kartyajatekok&_brand=pokemon-tcg&~1');
    const before=shop(db,'cardverse'),other=shop(db,'gamerunner');
    initializeDatabase(db);assert.deepEqual(shop(db,'cardverse'),{...before,url:CARDVERSE_URL});assert.deepEqual(shop(db,'gamerunner'),other);
    initializeDatabase(db);assert.deepEqual(shop(db,'cardverse'),{...before,url:CARDVERSE_URL});
    db.prepare("UPDATE pokemon_shops SET url='https://custom.example/' WHERE id='cardverse'").run();initializeDatabase(db);assert.equal(shop(db,'cardverse').url,'https://custom.example/');
  }finally{db.close();}
});
