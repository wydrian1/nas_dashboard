import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { MYTHGAMES_URL, MYTHGAMES_COLLECTION, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, mythgamesFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const MYTHGAMES_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function mythgamesProductUrl(input:string):string {
  const url=new URL(input,'https://mythgames.eu');
  if(url.origin!=='https://mythgames.eu' || url.username || url.password)throw new Error('Érvénytelen MythGames terméklink.');
  const match=url.pathname.match(new RegExp(`^(?:${MYTHGAMES_COLLECTION})?/products/([a-z0-9-]+)$`));
  if(!match)throw new Error('Érvénytelen MythGames termékútvonal.');
  return `https://mythgames.eu/products/${match[1]}`;
}
export function parseMythgamesCollection(html:string) {
  const $=load(html),canonical=$('link[rel="canonical"]').attr('href');
  if(canonical!==`https://mythgames.eu${MYTHGAMES_COLLECTION}` || !$('input[name="filter.v.availability"][value="1"][checked]').length)throw new Error('A MythGames készletes Pokémon-kategóriája nem ismerhető fel.');
  const count=normalize($('.hdt-active-filters__count > span').first().text());
  if(!/^\d+$/.test(count) || Number(count)>600)throw new Error('Nem olvasható MythGames termékszám.');
  const grid=$('hdt-reval-items.hdt-collection-products[id^="products-"]');
  if(grid.length!==1)throw new Error('Nem egyértelmű MythGames terméklista.');
  const products:PokemonProduct[]=[];
  grid.children('hdt-card-product').each((_index,element)=>{
    const card=$(element),link=card.find('a.hdt-card-product__title').first(),title=normalize(link.text());
    if(!link.attr('href') || !title || title.length>400)throw new Error('Hiányos MythGames termékkártya.');
    const url=mythgamesProductUrl(link.attr('href')!);
    let image:string|null=null;
    try{const candidate=new URL(card.find('img.hdt-card-product__media--main').attr('src') || '',url);if(candidate.protocol==='https:' && ['mythgames.eu','cdn.shopify.com'].includes(candidate.hostname) && !candidate.username && !candidate.password && candidate.pathname.includes('/cdn/'))image=candidate.href;}catch{/* Optional image. */}
    const price=normalize(card.find('hdt-price .hdt-money').first().text());
    const priceMatch=price.match(/^([\d.\s]+)\s*Ft$/),amount=priceMatch ? Number(priceMatch[1].replace(/[.\s]/g,'')) : NaN;
    // User rule: every card in this verified availability=1 list is available.
    // Product-level identity; no product pages, cart checks or variant enumeration.
    products.push({externalID:new URL(url).pathname.slice('/products/'.length),sku:'',title,url,image,
      priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,
      availability:/előrendel|pre.order/i.test(normalize(card.find('.hdt-badge').text())+' '+title) ? 'preorder' : 'available'});
  });
  if(new Set(products.map(product=>product.externalID)).size!==products.length || products.length>Number(count) || (Number(count)>0 && !products.length))throw new Error('Hiányos vagy duplikált MythGames lista.');
  return {products,total:Number(count)};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanMythgames(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){
    const source=await download('https://mythgames.eu/robots.txt',signal);
    if(!/user-agent:/i.test(source))throw new Error('A MythGames robots.txt nem értelmezhető.');
    robots={source,time:Date.now()};if(!options.download)robotsCache=robots;
  }
  let requests=0;
  const get=async(input:string)=>{
    signal.throwIfAborted();const url=mythgamesFetchUrl(input),gate=robotsPermission(robots.source,url.pathname+url.search);
    if(!gate.allowed)throw new Error('A MythGames robots.txt nem engedi ezt a lekérést.');
    if(++requests>60)throw new Error('A MythGames vizsgálat elérte a 60 oldalas lekérési korlátot.');
    await wait(gate.delayMs,signal);return download(url.href,signal);
  };
  const products:PokemonProduct[]=[],seen=new Set<string>();let total:number|undefined,pages=0;
  for(let page=1;page<=50;page++){
    const url=new URL(MYTHGAMES_URL);if(page>1)url.searchParams.set('page',String(page));
    const parsed=parseMythgamesCollection(await get(url.href));pages++;
    if(total!==undefined && parsed.total!==total)throw new Error('A MythGames kínálata megváltozott lapozás közben.');
    total=parsed.total;
    for(const product of parsed.products){if(seen.has(product.externalID))throw new Error('Ismételt MythGames lapozási eredmény.');seen.add(product.externalID);products.push(product);}
    if(products.length>total)throw new Error('Nem egyezik a MythGames teljes termékszáma.');
    if(products.length===total)break;
  }
  if(products.length!==total)throw new Error('Nem teljes MythGames kategóriavizsgálat.');
  return {products,total:products.length,pages,scannedAt:Date.now()};
}
