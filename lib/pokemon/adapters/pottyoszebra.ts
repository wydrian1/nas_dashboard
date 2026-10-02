import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { POTTYOSZEBRA_URL, POTTYOSZEBRA_CATEGORY, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const POTTYOSZEBRA_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function pottyoszebraProductUrl(input:string):string {
  const url=new URL(input,'https://pottyoszebra.hu');
  if(url.origin!=='https://pottyoszebra.hu' || url.username || url.password || !/^\/[a-z0-9-]+\/?$/i.test(url.pathname) || url.pathname==='/index.php')throw new Error('Érvénytelen Pöttyös Zebra terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parsePottyoszebraPage(html:string,expectedPage=1) {
  const $=load(html);
  const canonical=new URL($('link[rel="canonical"]').attr('href') || 'about:blank');
  if(!$('body.category-list-body').length || !/pok[eé]mon/i.test($('.page-head-title').first().text()) || canonical.origin!=='https://pottyoszebra.hu' || canonical.pathname!==POTTYOSZEBRA_CATEGORY || canonical.username || canonical.password || canonical.hash || [...canonical.searchParams.keys()].some(key=>key!=='page' || canonical.searchParams.getAll(key).length!==1) || (canonical.searchParams.get('page') || '1')!==String(expectedPage) || !$('#stockfilter-checkbox').is('[checked]'))throw new Error('A Pöttyös Zebra készletes Pokémon-kategóriája vagy oldalszáma nem ismerhető fel.');
  const summaries=$('.pagination__results').toArray().map(element=>normalize($(element).text()));
  const range=summaries[0]?.match(/^(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)\s+termék$/i);
  if(!range || summaries.some(summary=>summary!==summaries[0]))throw new Error('A Pöttyös Zebra termékszáma vagy lapozása nem olvasható.');
  const [start,end,total]=range.slice(1).map(Number);
  if(total>600 || end>total || (total>0 && (start<1 || end<start)))throw new Error('Érvénytelen Pöttyös Zebra lapozási adatok.');
  const cards=$('.product-list > .product-snapshot-vertical > .product-snapshot');
  const products:PokemonProduct[]=[];
  cards.each((_index,element)=>{
    const card=$(element),link=card.find('.product-card__title a').first(),cart=card.find('.button-add-to-cart');
    const id=card.find('input[name="product_id"]').first().attr('value') || '';
    if(!/^\d+$/.test(id) || !link.attr('href'))throw new Error('Hiányzó Pöttyös Zebra termékazonosító vagy link.');
    if(!cart.length || cart.is('.disabled,[disabled],[aria-disabled="true"]'))return;
    if(cart.length!==1 || cart.attr('data-product-id')!==id || !/kosárba/i.test(normalize(cart.text())))throw new Error('Nem felismerhető Pöttyös Zebra kosárgomb vagy termékazonosító.');
    const title=normalize(link.text()),stock=normalize(card.find('.product-card__stock').text());
    if(!title || title.length>500)throw new Error('Hiányzó Pöttyös Zebra terméknév.');
    const rawPrice=cart.attr('data-price-without-currency');
    const amount=cart.attr('data-currency')==='HUF' && rawPrice && /^\d+(\.\d+)?$/.test(rawPrice) ? Math.round(Number(rawPrice)) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('.product-card-image img').first().attr('src') || '');if(candidate.origin==='https://pottyoszebra.cdn.shoprenter.hu' && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    products.push({externalID:id,sku:normalize(cart.attr('data-product-sku') || ''),title,url:pottyoszebraProductUrl(link.attr('href')!),image,
      priceHuf:Number.isFinite(amount) && amount>=0 && amount<=100_000_000 ? amount : null,
      availability:/előrendel/i.test(stock) ? 'preorder' : /^(Raktáron|Utolsó [1-9]\d* db raktáron)$/.test(stock) ? 'in_stock' : 'available'});
  });
  if(cards.length && !cards.find('.button-add-to-cart').length)throw new Error('A Pöttyös Zebra kosárgomb-szerkezete nem ismerhető fel.');
  if(cards.length!==(total===0 ? 0 : end-start+1) || new Set(products.map(product=>product.externalID)).size!==products.length)throw new Error('Hiányos vagy duplikált Pöttyös Zebra terméklista.');
  return {products,start,end,total,cardCount:cards.length};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanPottyoszebra(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){
    const source=await download('https://pottyoszebra.hu/robots.txt',signal);
    if(!/user-agent:/i.test(source))throw new Error('A Pöttyös Zebra robots.txt nem értelmezhető.');
    robots={source,time:Date.now()};if(!options.download)robotsCache=robots;
  }
  const products:PokemonProduct[]=[],seen=new Set<string>();let total:number|undefined,cards=0;
  for(let page=1;page<=50;page++){
    signal.throwIfAborted();
    // Storefront pager links omit stockfilter; reconstruct every URL with stockfilter=1.
    const url=new URL(POTTYOSZEBRA_URL);if(page>1)url.searchParams.set('page',String(page));
    const gate=robotsPermission(robots.source,url.pathname+url.search);
    if(!gate.allowed)throw new Error('A Pöttyös Zebra robots.txt nem engedi ezt a lekérést.');
    await wait(gate.delayMs,signal);
    const parsed=parsePottyoszebraPage(await download(url.href,signal),page);
    if(total!==undefined && total!==parsed.total)throw new Error('A Pöttyös Zebra kínálata megváltozott lapozás közben.');
    total=parsed.total;
    if(total>0 && parsed.start!==cards+1)throw new Error('Nem folytonos Pöttyös Zebra lapozás.');
    cards+=parsed.cardCount;
    for(const product of parsed.products){if(seen.has(product.externalID))throw new Error('Ismételt Pöttyös Zebra termék lapozás közben.');seen.add(product.externalID);products.push(product);}
    if(parsed.end===total){if(cards!==total)throw new Error('Nem teljes Pöttyös Zebra vizsgálat.');return {products,total:products.length,pages:page,scannedAt:Date.now()};}
  }
  throw new Error('A Pöttyös Zebra vizsgálat elérte a lapozási korlátot.');
}
