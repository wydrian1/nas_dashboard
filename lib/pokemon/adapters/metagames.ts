import { load } from 'cheerio';
import { setTimeout as delay } from 'node:timers/promises';
import { METAGAMES_URL, METAGAMES_CATEGORY, type PokemonProduct, type ShopScan } from '../types.ts';
import { downloadShopPage, metagamesFetchUrl } from '../fetch-policy.ts';
import { robotsPermission } from '../robots.ts';
import type { CatalogScanOptions } from './catalog-scan.ts';

export const METAGAMES_ADAPTER_VERSION='1.1.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function metagamesProductUrl(input:string):string {
  const url=new URL(input,METAGAMES_URL);
  if(url.origin!=='https://www.metagames.hu' || url.username || url.password || url.search || url.hash || !new RegExp('^'+METAGAMES_CATEGORY+'/(?:[a-z0-9-]+/)*[a-z0-9-]+-pid[1-9]\\d*$','i').test(url.pathname))throw new Error('Érvénytelen Metagames-terméklink.');
  return url.href;
}
export function parseMetagamesPage(html:string,expectedPage=0) {
  const $=load(html),stock=$('select[name="isOnStock"]'),size=$('select[name="pageSizeSelect"]');
  if(!$('h1').toArray().some(el=>normalize($(el).text())==='Pokémon TCG') || stock.length!==1 || stock.find('option[selected]').length!==1 || stock.find('option[selected]').attr('value')!=='' || size.length!==1 || size.find('option[selected]').length!==1 || normalize(size.find('option[selected]').text())!=='12')throw new Error('A Metagames szűrés nélküli Pokémon-kategóriája vagy oldalmérete nem ismerhető fel.');
  const navigators=$('.pagination nav');
  if(navigators.length!==2)throw new Error('Hiányos Metagames-lapozás.');
  const index=(href:string|undefined)=>{if(!href)throw new Error('Hiányzó Metagames-lapozási link.');const url=metagamesFetchUrl(new URL(href,METAGAMES_URL).href);const page=url.searchParams.get('page');if(page===null)throw new Error('Hiányzó Metagames-oldalszám.');return Number(page);};
  let lastPage:number|undefined;
  navigators.each((_,el)=>{
    const nav=$(el),bound=nav.find('a[title="Go to last page"],a[title="Ugrás az utolsó oldalra"]');
    if(bound.length!==1)throw new Error('Hiányzó Metagames utolsó oldal.');
    const last=index(bound.attr('href'));
    if(lastPage!==undefined && last!==lastPage || expectedPage<0 || expectedPage>last)throw new Error('Nem egyezik a Metagames lapozási határa.');
    lastPage=last;
    for(const [english,hungarian,value]of [['Go to first page','Ugrás az első oldalra',0],['Go to previous page','Ugrás az előző oldalra',Math.max(0,expectedPage-1)],['Go to next page','Ugrás a következő oldalra',Math.min(last,expectedPage+1)]] as const){const link=nav.find(`a[title="${english}"],a[title="${hungarian}"]`);if(link.length!==1 || index(link.attr('href'))!==value)throw new Error('Nem egyezik a Metagames aktuális oldala.');}
    const numbered=nav.find('a[title^="Go to page "],a[title^="Ugrás a(z) "]');let current=false;
    numbered.each((_,link)=>{const item=$(link),page=index(item.attr('href'));if(page>last || normalize(item.text())!==String(page+1) || !['Go to page '+(page+1),'Ugrás a(z) '+(page+1)+' oldalra'].includes(item.attr('title') || ''))throw new Error('Érvénytelen Metagames számozott lapozás.');if(page===expectedPage)current=true;});
    if(!current)throw new Error('Hiányzó Metagames aktuális oldalszám.');
  });
  const cards=$('.webshop-list-item'),grids=cards.map((_,el)=>$(el).closest('.row.justify-content-start')[0]).get();
  if(lastPage===undefined || !cards.length || cards.length>12 || (expectedPage<lastPage && cards.length!==12) || grids.length!==cards.length || grids.some(el=>el!==grids[0]) || !grids[0])throw new Error('Hiányos vagy nem igazolt üres Metagames-lista.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_,el)=>{
    const card=$(el).closest('.card'),link=card.find('.webshop-list-item-name a'),cart=card.find('button[id^="buy"],button[id^="preOrder"]');
    if(card.length!==1 || link.length!==1 || !link.attr('href'))throw new Error('Hiányos Metagames-termékkártya.');
    const url=metagamesProductUrl(link.attr('href')!),id=url.match(/-pid([1-9]\d*)$/)![1],title=normalize(link.text());
    const restock=card.find('button[id^="subscribeItemRestock"]');
    if(restock.length){
      if(!title || title.length>500 || cart.length!==0 || restock.length!==1 || restock.attr('id')!=='subscribeItemRestock'+id || normalize(restock.text())!=='Készletértesítő' || card.find('.text-success.font-weight-bold').length!==0 || card.find('.text-danger.font-weight-bold').length!==1 || normalize(card.find('.text-danger.font-weight-bold').text())!=='Nincs készleten')throw new Error('Ismeretlen Metagames-készletállapot.');
      cardIDs.push(id);return;
    }
    const preorder=cart.attr('id')==='preOrder'+id;
    if(!title || title.length>500 || cart.length!==1 || (!preorder && cart.attr('id')!=='buy'+id) || !/^Kosárba$/i.test(normalize(cart.text())))throw new Error('Nem felismerhető Metagames-kosárgomb vagy termékazonosító.');
    cardIDs.push(id);
    if(cart.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(cart.attr('style') || ''))return;
    const stock=card.find('.text-success.font-weight-bold'),preorderStock=card.find('.text-danger.font-weight-bold');
    if(preorder ? stock.length!==0 || preorderStock.length!==1 || !/^Előrendelhető(?: \(\d{4}\.\d{2}\.\d{2}\))?$/.test(normalize(preorderStock.text())) : stock.length!==1 || normalize(stock.text())!=='Készleten' || preorderStock.length!==0)throw new Error('Ismeretlen Metagames-készletállapot.');
    const raw=normalize(card.find('h5').first().text()),amount=/^[\d ]+ Ft$/.test(raw) ? Number(raw.replace(/ Ft$/,'').replaceAll(' ','')) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('.product-list-image img').attr('src') || '',METAGAMES_URL);if(candidate.origin==='https://www.metagames.hu' && candidate.pathname==='/thumb/' && !candidate.username && !candidate.password && !candidate.hash && [...candidate.searchParams.keys()].length===1 && candidate.searchParams.getAll('path').length===1 && /^\/upload\/images\/[a-z0-9_./-]+$/i.test(candidate.searchParams.get('path') || '') && !candidate.searchParams.get('path')!.split('/').includes('..'))image=candidate.href;}catch{/* Image is optional; never fetch it in the worker. */}
    products.push({externalID:id,sku:'',title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:preorder?'preorder':'in_stock'});
  });
  if(new Set(cardIDs).size!==cards.length)throw new Error('Duplikált Metagames-termékkártya.');
  return {products,cardIDs,lastPage,cardCount:cards.length};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanMetagames(signal:AbortSignal,options:CatalogScanOptions={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://www.metagames.hu/robots.txt',signal);if(/<\/?[a-z][^>]*>/i.test(source) || !/^User-agent:/im.test(source))throw new Error('A Metagames robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  async function page(index:number){signal.throwIfAborted();const url=new URL(METAGAMES_URL);if(index)url.searchParams.set('page',String(index));metagamesFetchUrl(url.href);const gate=robotsPermission(robots!.source,url.pathname+url.search);if(!gate.allowed)throw new Error('A Metagames robots.txt nem engedi ezt a lekérést.');await wait(gate.delayMs,signal);return parseMetagamesPage(await download(url.href,signal),index);}
  const first=await page(0),last=first.lastPage ? await page(first.lastPage) : first,total=first.lastPage*12+last.cardCount;
  if(last.lastPage!==first.lastPage || total>600)throw new Error('A Metagames lapozása megváltozott vagy túl nagy.');
  const products:PokemonProduct[]=[],ids:string[]=[];
  for(let index=0;index<=first.lastPage;index++){
    const current=index===0 ? first : await page(index);
    if(current.lastPage!==first.lastPage || (index===first.lastPage && JSON.stringify(current.cardIDs)!==JSON.stringify(last.cardIDs)))throw new Error('A Metagames készlete megváltozott lapozás közben.');
    ids.push(...current.cardIDs);products.push(...current.products);
    if(new Set(ids).size!==ids.length)throw new Error('Ismételt Metagames-termék lapozás közben.');
  }
  if(ids.length!==total)throw new Error('Nem teljes Metagames-vizsgálat.');
  if(first.lastPage){const head=await page(0);if(head.lastPage!==first.lastPage || JSON.stringify(head.cardIDs)!==JSON.stringify(first.cardIDs))throw new Error('A Metagames lista eleje megváltozott lapozás közben.');}
  return {products,total:products.length,pages:first.lastPage+1,scannedAt:Date.now()};
}
