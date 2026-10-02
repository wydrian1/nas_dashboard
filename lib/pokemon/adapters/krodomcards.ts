import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { KRODOMCARDS_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, krodomcardsFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const KRODOMCARDS_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function krodomcardsProductUrl(input:string):string {
  const url=new URL(input,'https://www.krodomcards.hu');
  if(url.origin!=='https://www.krodomcards.hu' || url.username || url.password || !/^\/[a-z0-9_-]+\/?$/i.test(url.pathname))throw new Error('Érvénytelen Krodom Cards terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseKrodomcardsPage(html:string,expectedPage=1) {
  const $=load(html),brands=$('input[name="system_manufacturer[]"][checked]'),categories=$('input[name="category_id"]');
  if(!$('body.filter-list-body').length || !/^Termékek szűrése$/i.test(normalize($('h1').first().text())) || brands.length!==1 || brands.attr('value')!=='80' || !categories.length || categories.toArray().some(element=>$(element).attr('value')!=='284'))throw new Error('A Krodom Cards kijelölt Pokémon-szűrője nem ismerhető fel.');
  const summaries=$('.pagination__results').toArray().map(element=>normalize($(element).text()));
  const range=summaries[0]?.match(/^(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)\s+termék$/i);
  if(!range || summaries.some(text=>text!==summaries[0]))throw new Error('A Krodom Cards termékszáma vagy lapozása nem olvasható.');
  const [start,end,total]=range.slice(1).map(Number);
  if(total>600 || end>total || (total>0 && (start<1 || end<start)))throw new Error('Érvénytelen Krodom Cards lapozási adatok.');
  const current=$('.pagination a[aria-current="page"]');
  if(total>0 && (!current.length || current.toArray().some(element=>{
    const link=$(element),url=new URL(link.attr('href') || '',KRODOMCARDS_URL);url.hash='';krodomcardsFetchUrl(url.href);
    return normalize(link.text())!==String(expectedPage) || (url.searchParams.get('page') || '1')!==String(expectedPage);
  })))throw new Error('Nem egyezik a Krodom Cards aktuális oldala vagy szűrője.');
  const cards=$('#product-list.product-list > .product-snapshot-vertical > .product-snapshot');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),id=card.find('input[name="product_id"]').attr('value') || '',link=card.find('.product-card__title a'),cart=card.find('.button-add-to-cart');
    if(!/^[1-9]\d*$/.test(id) || link.length!==1 || !link.attr('href'))throw new Error('Hiányos Krodom Cards termékkártya.');
    const title=normalize(link.text()),url=krodomcardsProductUrl(link.attr('href')!);
    if(!title || title.length>500)throw new Error('Hiányzó Krodom Cards terméknév.');
    cardIDs.push(id);
    if(!cart.length){
      const details=card.find('.product-card__details-button');
      if(card.find('.product-card__addtocart').length || details.length!==1 || !details.attr('href') || krodomcardsProductUrl(details.attr('href')!)!==url)throw new Error('A Krodom Cards kosárgomb-szerkezete nem ismerhető fel.');
      return; // Some unavailable products have only a matching details link, no cart/notification area.
    }
    if(cart.length!==1 || cart.attr('data-product-id')!==id)throw new Error('Nem felismerhető Krodom Cards gomb vagy termékazonosító.');
    if(cart.is('.disabled,[disabled],[aria-disabled="true"],[hidden]'))return;
    // The shop reuses button-add-to-cart on stock-notification links. They are NOT cart buttons.
    const action=new URL(cart.attr('href') || '',KRODOMCARDS_URL);
    if(action.origin!=='https://www.krodomcards.hu' || action.pathname!=='/index.php' || action.username || action.password || action.searchParams.get('product_id')!==id)throw new Error('Nem felismerhető Krodom Cards gombcél.');
    const route=action.searchParams.get('route');
    if(route==='waitinglist/waitinglist' && /értesítés/i.test(normalize(cart.text())))return;
    if(cart.is('.notify-request') || route!=='checkout/cart' || !/kosárba/i.test(normalize(cart.text())))throw new Error('Ismeretlen Krodom Cards kosárgombállapot.');
    const rawPrice=cart.attr('data-price-without-currency');
    const amount=cart.attr('data-currency')==='HUF' && rawPrice && /^\d+(\.\d+)?$/.test(rawPrice) ? Math.round(Number(rawPrice)) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('.product-card-image img').attr('src') || '');if(candidate.origin==='https://pokedom.cdn.shoprenter.hu' && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional legacy shop CDN image. */}
    const stock=normalize(card.find('.product-card__stock-label').text());
    products.push({externalID:id,sku:normalize(cart.attr('data-product-sku') || '').slice(0,100),title,url,image,
      priceHuf:Number.isFinite(amount) && amount>=0 && amount<=100_000_000 ? amount : null,
      availability:/előrendel/i.test(stock) ? 'preorder' : /^(Raktáron|Utolsó [1-9]\d* db raktáron)$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if(cards.length!==(total===0 ? 0 : end-start+1) || new Set(cardIDs).size!==cardIDs.length)throw new Error('Hiányos vagy duplikált Krodom Cards terméklista.');
  return {products,start,end,total,cardCount:cards.length,cardIDs};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanKrodomcards(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){
    const source=await download('https://www.krodomcards.hu/robots.txt',signal);
    if(!/user-agent:/i.test(source))throw new Error('A Krodom Cards robots.txt nem értelmezhető.');
    robots={source,time:Date.now()};if(!options.download)robotsCache=robots;
  }
  const products:PokemonProduct[]=[],seen=new Set<string>();let total:number|undefined,cards=0;
  for(let page=1;page<=50;page++){
    signal.throwIfAborted();const url=new URL(KRODOMCARDS_URL);if(page>1)url.searchParams.set('page',String(page));
    krodomcardsFetchUrl(url.href);const gate=robotsPermission(robots.source,url.pathname+url.search);
    if(!gate.allowed)throw new Error('A Krodom Cards robots.txt nem engedi ezt a lekérést.');
    await wait(gate.delayMs,signal);
    const parsed=parseKrodomcardsPage(await download(url.href,signal),page);
    if(total!==undefined && parsed.total!==total)throw new Error('A Krodom Cards kínálata megváltozott lapozás közben.');
    total=parsed.total;if(total>0 && parsed.start!==cards+1)throw new Error('Nem folytonos Krodom Cards lapozás.');
    for(const id of parsed.cardIDs){if(seen.has(id))throw new Error('Ismételt Krodom Cards termékkártya lapozás közben.');seen.add(id);}
    cards+=parsed.cardCount;products.push(...parsed.products);
    if(parsed.end===total){if(cards!==total)throw new Error('Nem teljes Krodom Cards kategóriavizsgálat.');return {products,total:products.length,pages:page,scannedAt:Date.now()};}
  }
  throw new Error('A Krodom Cards vizsgálat elérte a lapozási korlátot.');
}
