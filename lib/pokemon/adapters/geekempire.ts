import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { GEEKEMPIRE_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, geekempireFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const GEEKEMPIRE_ADAPTER_VERSION='1.1.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function geekempireProductUrl(input:string):string {
  const url=new URL(input,GEEKEMPIRE_URL);
  if(url.origin!=='https://geekempire.hu' || url.username || url.password || !/^\/termek\/[a-z0-9-]+\/$/i.test(url.pathname))throw new Error('Érvénytelen GeekEmpire terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseGeekempirePage(html:string) {
  const $=load(html),canonical=$('link[rel="canonical"]');
  // The live category has two SEO canonical tags: the requested path and a legacy alias.
  const canonicals=canonical.toArray().map(e=>$(e).attr('href'));
  if(!$('body.tax-product_cat.term-pokemon-kartya').length || normalize($('h1').text())!=='Pokémon Kártya' || !canonicals.includes(GEEKEMPIRE_URL) || canonicals.length>2 || canonicals.some(href=>![GEEKEMPIRE_URL,'https://geekempire.hu/termekkategoria/pokemon-kartya/'].includes(href || '')))throw new Error('A GeekEmpire Pokémon-kategória nem ismerhető fel.');
  const summaries=$('.woocommerce-result-count').toArray().map(e=>normalize($(e).text())),match=summaries[0]?.match(/^Mind a\(z\) (\d+) találat megjelenítve$/);
  if(!match || summaries.some(text=>text!==summaries[0]) || Number(match[1])>600 || $('.woocommerce-pagination').length)throw new Error('A GeekEmpire kategória nem teljes vagy többoldalas; a korábbi állapot megmarad.');
  const total=Number(match[1]),lists=$('ul.products'),cards=lists.children('li.product');
  if(lists.length!==1 || cards.length!==total)throw new Error('Hiányos GeekEmpire terméklista.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),ids=(card.attr('class') || '').match(/\bpost-([1-9]\d*)\b/g),id=ids?.length===1 ? ids[0].slice(5) : '',link=card.children('a.woocommerce-loop-product__link'),title=normalize(link.find('.woocommerce-loop-product__title').text()),button=card.children('a.button');
    if(!id || !card.is('.product_cat-pokemon-kartya') || link.length!==1 || !link.attr('href') || !title || title.length>500)throw new Error('Hiányos GeekEmpire termékkártya vagy azonosító.');
    const url=geekempireProductUrl(link.attr('href')!);cardIDs.push(id);
    const stockElements=card.find('.stock'),stock=normalize(stockElements.text()),reserved=stockElements.length===1 && /^Foglalt$/i.test(stock);
    if(reserved && !button.is('.add_to_cart_button')){
      if(button.length>1 || (button.length===1 && button.attr('data-product_id')!==undefined && button.attr('data-product_id')!==id))throw new Error('Hiányos GeekEmpire termékkártya vagy azonosító.');
      if(button.length){const details=new URL(button.attr('href') || '',GEEKEMPIRE_URL);if(details.search || details.hash || geekempireProductUrl(details.href)!==url || /kosárba/i.test(normalize(button.text())))throw new Error('Nem felismerhető GeekEmpire termékgomb.');}
      return; // Explicit reserved stock may omit the normal cart button/ID, but still counts toward completeness.
    }
    if(button.length!==1 || button.attr('data-product_id')!==id)throw new Error('Hiányos GeekEmpire termékkártya vagy azonosító.');
    if(!button.is('.add_to_cart_button') || button.is('.product_type_variable')){
      const details=new URL(button.attr('href') || '',GEEKEMPIRE_URL);
      if(details.search || details.hash || geekempireProductUrl(details.href)!==url || /kosárba/i.test(normalize(button.text())))throw new Error('Nem felismerhető GeekEmpire termékgomb.');
      return; // Variable/options and unavailable details-only cards are not active cart buttons.
    }
    const action=new URL(button.attr('href') || '',GEEKEMPIRE_URL);
    if(!button.is('.product_type_simple') || !/^Kosárba$/i.test(normalize(button.text())) || action.origin!=='https://geekempire.hu' || action.username || action.password || action.pathname!==new URL(GEEKEMPIRE_URL).pathname || action.hash || action.searchParams.get('add-to-cart')!==id || [...action.searchParams.keys()].some(key=>key!=='add-to-cart' || action.searchParams.getAll(key).length!==1))throw new Error('Nem felismerhető GeekEmpire kosárgomb vagy cél.');
    if(reserved || button.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(button.attr('style') || ''))return;
    const amountElement=card.find('.price ins .woocommerce-Price-amount').length ? card.find('.price ins .woocommerce-Price-amount').last() : card.find('.price .woocommerce-Price-amount').last();
    const price=normalize(amountElement.text()),raw=price.match(/^([\d ]+) Ft$/),amount=raw ? Number(raw[1].replace(/ /g,'')) : NaN;
    let image:string|null=null;
    try{const img=link.find('img.attachment-woocommerce_thumbnail'),candidate=new URL(img.attr('data-src') || img.attr('src') || '');if(candidate.origin==='https://geekempire.hu' && candidate.pathname.startsWith('/wp-content/uploads/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    products.push({externalID:id,sku:normalize(button.attr('data-product_sku') || '').slice(0,100),title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(stock) ? 'preorder' : /^Készleten$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if(new Set(cardIDs).size!==total)throw new Error('Duplikált GeekEmpire terméklista.');
  return {products,total,cardIDs};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanGeekempire(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://geekempire.hu/robots.txt',signal);if(!/user-agent:/i.test(source))throw new Error('A GeekEmpire robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  signal.throwIfAborted();const url=geekempireFetchUrl(GEEKEMPIRE_URL),gate=robotsPermission(robots.source,url.pathname+url.search);
  if(!gate.allowed)throw new Error('A GeekEmpire robots.txt nem engedi a kategória lekérését.');
  await wait(gate.delayMs,signal);const parsed=parseGeekempirePage(await download(url.href,signal));
  return {products:parsed.products,total:parsed.products.length,pages:1,scannedAt:Date.now()};
}
