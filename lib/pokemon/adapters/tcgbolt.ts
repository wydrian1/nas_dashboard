import {load} from 'cheerio';
import {setTimeout as delay} from 'node:timers/promises';
import {TCGBOLT_URL,TCGBOLT_CATEGORY,type PokemonProduct,type ShopScan} from '../types.ts';
import {downloadShopPage,tcgboltFetchUrl} from '../fetch-policy.ts';
import {robotsPermission} from '../robots.ts';
import type {CatalogScanOptions} from './catalog-scan.ts';

export const TCGBOLT_ADAPTER_VERSION='1.1.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const pageUrl=(page:number)=>page===1 ? TCGBOLT_URL : TCGBOLT_URL+'page/'+page+'/';
export function tcgboltProductUrl(input:string):string {
  const url=new URL(input,TCGBOLT_URL);
  if(url.origin!=='https://tcgbolt.hu' || url.username || url.password || url.search || url.hash || !/^\/bolt\/[a-z0-9-]+\/$/i.test(url.pathname))throw new Error('Érvénytelen TCG Bolt terméklink.');
  return url.href;
}
export function parseTcgboltPage(html:string,expectedPage=1) {
  const $=load(html),canonical=$('link[rel="canonical"]');
  if(!Number.isInteger(expectedPage) || expectedPage<1 || expectedPage>50 || !$('body.tax-product_cat.term-pokemon').length || normalize($('h1.page-title').text())!=='Pokémon' || canonical.length!==1 || canonical.attr('href')!==pageUrl(expectedPage))throw new Error('Nem ismerhető fel a TCG Bolt Pokémon-kategóriája vagy aktuális oldala.');
  const summary=$('.woocommerce-result-count').clone();summary.find('.screen-reader-text').remove();
  const text=normalize(summary.text()),range=text.match(/^(\d+)[–-](\d+) termék, összesen (\d+) db$/),single=text.match(/^Mind a\(z\) (\d+) találat megjelenítve$/);
  const total=range ? Number(range[3]) : single ? Number(single[1]) : NaN,first=(expectedPage-1)*30+1,last=Math.min(expectedPage*30,total),pages=Math.ceil(total/30);
  if(summary.length!==1 || !Number.isSafeInteger(total) || total<1 || total>600 || expectedPage>pages || (range ? Number(range[1])!==first || Number(range[2])!==last : total>30 || expectedPage!==1))throw new Error('Hiányos vagy nem igazolt üres TCG Bolt összesítő.');
  const nav=$('nav.woocommerce-pagination');
  if(pages>1){
    if(nav.length!==1 || nav.find('[aria-current="page"]').length!==1 || normalize(nav.find('[aria-current="page"]').text())!==String(expectedPage))throw new Error('Hiányos TCG Bolt lapozás.');
    const numbered:number[]=[expectedPage];
    nav.find('a.page-numbers').each((_,el)=>{const link=$(el),url=tcgboltFetchUrl(new URL(link.attr('href')||'',TCGBOLT_URL).href),index=url.pathname===TCGBOLT_CATEGORY ? 1 : Number(url.pathname.match(/\/page\/(\d+)\/$/)?.[1]);if(index<1 || index>pages || !Number.isInteger(index) || (link.is('.next') ? index!==expectedPage+1 : link.is('.prev') ? index!==expectedPage-1 : normalize(link.text())!==String(index)))throw new Error('Érvénytelen TCG Bolt lapozási cél.');if(!link.is('.next,.prev'))numbered.push(index);});
    if(!numbered.includes(pages) || nav.find('a.next').length!==(expectedPage<pages?1:0) || nav.find('a.prev').length!==(expectedPage>1?1:0))throw new Error('Nem igazolt TCG Bolt utolsó/következő oldal.');
  }else if(nav.length)throw new Error('Váratlan TCG Bolt lapozás.');
  const lists=$('.woocommerce > ul.products'),cards=lists.children('li.product');
  if(lists.length!==1 || cards.length!==last-first+1)throw new Error('Hiányos TCG Bolt terméklista.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_,el)=>{
    const card=$(el),ids=(card.attr('class')||'').match(/\bpost-([1-9]\d*)\b/g),id=ids?.length===1 ? ids[0].slice(5) : '',link=card.children('a.woocommerce-loop-product__link'),cart=card.children('a.button').not('.yith-wcqv-button'),title=normalize(link.find('.woocommerce-loop-product__title').text());
    // Membership comes from the verified category's direct list, not per-card taxonomy CSS.
    // Accessories in this list can legitimately carry only accessory category classes.
    if(!id || link.length!==1 || !link.attr('href') || !title || title.length>500 || cart.length!==1 || cart.attr('data-product_id')!==id)throw new Error('Hiányos TCG Bolt termékkártya vagy azonosító.');
    const url=tcgboltProductUrl(link.attr('href')!);cardIDs.push(id);
    if(!cart.is('.add_to_cart_button') || cart.is('.product_type_variable')){if(tcgboltProductUrl(cart.attr('href')||'')!==url || /kosárba/i.test(cart.text()))throw new Error('Ismeretlen TCG Bolt termékgomb.');return;}
    const action=new URL(cart.attr('href')||'',pageUrl(expectedPage)),target=new URL(action);target.search='';
    tcgboltFetchUrl(target.href);
    if(!cart.is('.product_type_simple') || normalize(cart.text())!=='Kosárba teszem' || action.pathname!==new URL(pageUrl(expectedPage)).pathname || action.searchParams.get('add-to-cart')!==id || [...action.searchParams.keys()].some(key=>key!=='add-to-cart' || action.searchParams.getAll(key).length!==1))throw new Error('Ismeretlen TCG Bolt kosárgomb vagy cél.');
    if(cart.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(cart.attr('style')||''))return;
    if(!card.is('.instock,.onbackorder') || card.is('.outofstock') || !card.is('.purchasable'))throw new Error('Ismeretlen TCG Bolt készletállapot.');
    const amountElements=card.find('.price ins .woocommerce-Price-amount').length ? card.find('.price ins .woocommerce-Price-amount') : card.find('.price > .woocommerce-Price-amount'),price=normalize(amountElements.text()),raw=price.match(/^((?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:,\d{1,2})?) Ft$/),amount=raw&&amountElements.length===1 ? Number(raw[1].replace(/[ .]/g,'').replace(',','.')) : NaN;
    let image:string|null=null;
    try{const img=link.find('img.attachment-woocommerce_thumbnail').first(),candidate=new URL(img.attr('data-src')||img.attr('src')||'',TCGBOLT_URL);if(!candidate.username && !candidate.password && !candidate.hash && (candidate.origin==='https://tcgbolt.hu'&&candidate.pathname.startsWith('/wp-content/uploads/') || /^https:\/\/i[0-2]\.wp\.com$/.test(candidate.origin)&&candidate.pathname.startsWith('/tcgbolt.hu/wp-content/uploads/')))image=candidate.href;}catch{/* Optional image; the worker never fetches it. */}
    products.push({externalID:id,sku:normalize(cart.attr('data-product_sku')||'').slice(0,100),title,url,image,priceHuf:Number.isFinite(amount)&&amount>=0&&amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(normalize(card.find('.stock').text())) ? 'preorder' : card.is('.instock') ? 'in_stock' : 'available'});
  });
  if(new Set(cardIDs).size!==cards.length)throw new Error('Duplikált TCG Bolt terméklista.');
  return {products,total,cardIDs,pages};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanTcgbolt(signal:AbortSignal,options:CatalogScanOptions={}):Promise<ShopScan> {
  const download=options.download||downloadShopPage,wait=options.wait||((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://tcgbolt.hu/robots.txt',signal);if(/<\/?[a-z][^>]*>/i.test(source)||!/^User-agent:/im.test(source))throw new Error('A TCG Bolt robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  async function page(index:number){signal.throwIfAborted();const url=tcgboltFetchUrl(pageUrl(index)),gate=robotsPermission(robots!.source,url.pathname);if(!gate.allowed)throw new Error('A TCG Bolt robots.txt nem engedi a kategória lekérését.');await wait(gate.delayMs,signal);return parseTcgboltPage(await download(url.href,signal),index);}
  const first=await page(1),products=[...first.products],ids=[...first.cardIDs];
  for(let index=2;index<=first.pages;index++){const current=await page(index);if(current.total!==first.total || current.pages!==first.pages)throw new Error('A TCG Bolt termékszáma megváltozott lapozás közben.');ids.push(...current.cardIDs);products.push(...current.products);if(new Set(ids).size!==ids.length)throw new Error('Ismételt TCG Bolt lapozási eredmény.');}
  if(ids.length!==first.total)throw new Error('Nem teljes TCG Bolt vizsgálat.');
  if(first.pages>1){const head=await page(1);if(JSON.stringify(head)!==JSON.stringify(first))throw new Error('A TCG Bolt lista eleje megváltozott lapozás közben.');}
  return {products,total:products.length,pages:first.pages,scannedAt:Date.now()};
}
