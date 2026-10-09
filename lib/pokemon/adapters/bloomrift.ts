import {load} from 'cheerio';
import {setTimeout as delay} from 'node:timers/promises';
import {BLOOMRIFT_URL,type PokemonProduct,type ShopScan} from '../types.ts';
import {bloomriftFetchUrl,downloadShopPage} from '../fetch-policy.ts';
import {robotsPermission} from '../robots.ts';
import type {CatalogScanOptions} from './catalog-scan.ts';

export const BLOOMRIFT_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const pageUrl=(page:number)=>BLOOMRIFT_URL+(page===1?'':','+page);
export function bloomriftProductUrl(input:string):string {
  const url=new URL(input,BLOOMRIFT_URL);
  if(url.origin!=='https://bloomrift.eu' || url.username || url.password || url.search || url.hash || !/^\/pokemon-[a-z0-9-]+$/i.test(url.pathname))throw new Error('Érvénytelen Bloomrift-terméklink.');
  return url.href;
}
export function parseBloomriftPage(html:string,expectedPage=1) {
  const $=load(html),canonical=$('link[rel="canonical"]');
  if(!Number.isInteger(expectedPage) || expectedPage<1 || expectedPage>50 || !$('html.page_shop_art_948779.main-cat-100002').length || canonical.length!==1 || canonical.attr('href')!==BLOOMRIFT_URL || $('h1').length!==1 || normalize($('h1').text())!=='Összes angol termék')throw new Error('Nem ismerhető fel a Bloomrift angol Pokémon-kategóriája.');
  const counters=$('.paging-sorting-ordering .product-num').toArray().map(element=>{const counter=$(element).clone();counter.find('.visually-hidden').remove();return normalize(counter.text());});
  const total=/^[1-9]\d*$/.test(counters[0]||'')?Number(counters[0]):NaN,pages=Math.ceil(total/12),count=Math.min(12,total-(expectedPage-1)*12);
  if(!counters.length || counters.some(text=>text!==counters[0]) || !Number.isSafeInteger(total) || total>600 || expectedPage>pages)throw new Error('Hiányos vagy nem igazolt üres Bloomrift-összesítő.');
  for(const [rel,target]of [['next',expectedPage<pages?pageUrl(expectedPage+1):null],['prev',expectedPage>1?pageUrl(expectedPage-1):null]] as const){const links=$(`link[rel="${rel}"]`);if(links.length!==(target?1:0) || target&&links.attr('href')!==target)throw new Error('Nem igazolt Bloomrift-lapozási cél.');}
  const scroll=$('script').toArray().flatMap(element=>$(element).text().match(/\bvar infinite_scroll_num=\d+;/g)||[]),loading=$('.page_artlist_next_loading [data-page]');
  if(expectedPage<pages ? scroll.length!==1 || scroll[0]!==`var infinite_scroll_num=${expectedPage};` || loading.length!==1 || loading.attr('data-page')!==String(expectedPage+1) : scroll.length!==0 || loading.length!==0)throw new Error('Ismeretlen Bloomrift-oldalbetöltési állapot.');
  const lists=$('#list-artlist_product_list[role="list"]'),cards=lists.children('.product[role="listitem"]');
  if(lists.length!==1 || cards.length!==count || lists.children('.product').length!==count)throw new Error('Hiányos Bloomrift-terméklista.');
  const cardIDs:string[]=[],products:PokemonProduct[]=[];
  cards.each((_,element)=>{
    const card=$(element),sku=card.attr('data-sku')||'',encoded=sku.replace(/-/g,'__unas__'),link=card.find('a.product__name-link'),title=normalize(link.text()),cart=card.find('button.product__cart-btn'),main=card.find('.product-main-btn'),stock=card.find('.product__stock'),stockText=normalize(stock.find('.stock__text').text());
    if(!/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/i.test(sku) || sku.length>100 || sku.includes('__unas__') || card.attr('id')!=='page_artlist_artlist_'+encoded || link.length!==1 || link.attr('data-sku')!==sku || !link.attr('href') || !title || title.length>500 || stock.length!==1 || stock.find('.stock__text').length!==1 || main.length!==1)throw new Error('Hiányos Bloomrift-termékkártya vagy SKU.');
    const url=bloomriftProductUrl(link.attr('href')!);cardIDs.push(sku);
    if(!cart.length){const details=card.find('a.product__details-btn');if(!stock.is('.no-stock') || stock.is('.on-stock') || stockText!=='Nincs raktáron' || details.length!==1 || details.attr('aria-label')!=='Részletek' || bloomriftProductUrl(details.attr('href')||'')!==url)throw new Error('Ismeretlen Bloomrift-kosárgombállapot.');return;}
    const quantity=card.find(`input[name="db_artlist_${encoded}"]`);
    if(cart.length!==1 || cart.attr('type')!=='button' || cart.attr('aria-label')!=='Kosárba' || cart.attr('data-text')!=='Kosárba' || cart.attr('onclick')!==`cart_add('${encoded}','artlist_');` || quantity.length!==1 || quantity.attr('id')!=='db_artlist_'+encoded || quantity.attr('type')!=='hidden' || quantity.attr('value')!=='1' || !stock.is('.on-stock') || stock.is('.no-stock') || !/^(Raktáron(?: \([1-9]\d* db\))?|Előrendelhető)$/i.test(stockText))throw new Error('Nem igazolt Bloomrift-kosárgomb vagy készlet.');
    const buttonChain=cart.add(cart.parentsUntil(lists));
    if(buttonChain.toArray().some(element=>$(element).is('.disabled,.d-none,.invisible,[disabled],[hidden],[aria-disabled="true"],[aria-hidden="true"]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test($(element).attr('style')||'')))return;
    const prices=card.find('.product__prices'),sale=prices.find('.product__price-sale'),priceElements=sale.length?sale:prices.find('.product__price-base'),price=normalize(priceElements.text()),raw=price.match(/^((?:\d{1,3}(?: \d{3})+|\d+)(?:,\d{1,2})?) Ft$/),amount=raw&&priceElements.length===1?Number(raw[1].replace(/ /g,'').replace(',','.')):NaN;
    let image:string|null=null;
    try{const img=card.find(`img[id="main_image_artlist_${encoded}"]`),candidate=new URL(img.attr('data-src')||img.attr('src')||'');if(img.length===1&&candidate.origin==='https://bloomrift.eu'&&!candidate.username&&!candidate.password&&!candidate.hash&&candidate.pathname.startsWith('/img/50416/'+sku+'/'))image=candidate.href;}catch{/* Optional image; never fetched by the worker. */}
    products.push({externalID:sku,sku,title,url,image,priceHuf:Number.isFinite(amount)&&amount>=0&&amount<=100_000_000?amount:null,availability:/előrendel/i.test(stockText)?'preorder':'in_stock'});
  });
  if(new Set(cardIDs).size!==cardIDs.length)throw new Error('Duplikált Bloomrift-SKU.');
  return {products,total,cardIDs,pages};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanBloomrift(signal:AbortSignal,options:CatalogScanOptions={}):Promise<ShopScan> {
  signal.throwIfAborted();const download=options.download||downloadShopPage,wait=options.wait||((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://bloomrift.eu/robots.txt',signal);if(/<\/?[a-z][^>]*>/i.test(source)||!/^User-agent:/im.test(source))throw new Error('A Bloomrift robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  async function page(index:number){signal.throwIfAborted();const url=bloomriftFetchUrl(pageUrl(index)),gate=robotsPermission(robots!.source,url.pathname);if(!gate.allowed)throw new Error('A Bloomrift robots.txt tiltja a kategória lekérését.');await wait(gate.delayMs,signal);return parseBloomriftPage(await download(url.href,signal),index);}
  const first=await page(1),products=[...first.products],ids=[...first.cardIDs];let last=first;
  for(let index=2;index<=first.pages;index++){last=await page(index);if(last.total!==first.total || last.pages!==first.pages)throw new Error('A Bloomrift termékszáma megváltozott lapozás közben.');ids.push(...last.cardIDs);products.push(...last.products);if(new Set(ids).size!==ids.length)throw new Error('Ismételt Bloomrift-lapozási eredmény.');}
  if(ids.length!==first.total)throw new Error('Nem teljes Bloomrift-vizsgálat.');
  if(first.pages>1 && (JSON.stringify(await page(1))!==JSON.stringify(first) || JSON.stringify(await page(first.pages))!==JSON.stringify(last)))throw new Error('A Bloomrift lista eleje/vége megváltozott lapozás közben.');
  return {products,total:products.length,pages:first.pages,scannedAt:Date.now()};
}
