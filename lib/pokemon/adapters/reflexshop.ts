import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { REFLEXSHOP_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, reflexshopFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const REFLEXSHOP_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function reflexshopProductUrl(input:string):string {
  const url=new URL(input,REFLEXSHOP_URL);
  if(url.origin!=='https://reflexshop.hu' || url.username || url.password || !/^\/[a-z0-9-]+$/i.test(url.pathname))throw new Error('Érvénytelen Reflexshop terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseReflexshopPage(html:string) {
  const $=load(html),root=$('#page_search_content.search-result-page-content');
  if(root.length!==1 || normalize(root.find('h1').text())!=='KERESÉS:pokemon tcg')throw new Error('A Reflexshop keresése nem ismerhető fel.');
  const checked=root.find('#param_product_status_content input[checked]');
  if(checked.length!==1 || checked.attr('value')!=='in_stock')throw new Error('A Reflexshop készletszűrője nem egyezik.');
  const counter=root.find('.counter-row [data-purpose="base-product-counter"]'),text=normalize(counter.text());
  if(counter.length!==1 || !/^\d+$/.test(text) || Number(text)>600)throw new Error('A Reflexshop találatszáma nem olvasható.');
  const total=Number(text),list=root.find('#page_artlist_content [data-purpose="product-list"]'),cards=list.children('article.product-card');
  // A larger paginated list must fail closed until its real pagination contract has been verified.
  if(list.length!==1 || cards.length!==total)throw new Error('A Reflexshop találati lista nem teljes vagy többoldalas; a korábbi állapot megmarad.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),link=card.find('a.name-link[data-sku]'),id=link.attr('data-sku') || '',title=normalize(link.text()),encoded=id.replace(/-/g,'__unas__');
    if(link.length!==1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id) || id.length>100 || card.attr('id')!=='page_artlist_artlist_'+encoded || !title || title.length>500 || !link.attr('href'))throw new Error('Hiányos Reflexshop termékkártya vagy SKU.');
    const url=reflexshopProductUrl(link.attr('href')!),cart=card.find('a.cart-button'),qty=card.find('input.page_qty_input');
    cardIDs.push(id);
    if(cart.length!==1 || cart.attr('role')!=='button' || cart.attr('aria-label')!=='Kosárba teszem' || cart.attr('href')!=='javascript:void(0)' || !new RegExp("^cart_add\\('"+encoded+"','artlist_'\\);$").test(cart.attr('onclick') || '') || qty.length!==1 || qty.attr('name')!=='db_artlist_'+encoded)throw new Error('Nem felismerhető Reflexshop kosárgomb vagy termékazonosító.');
    // Read the declarative cart action only; never evaluate JS or request a cart/AJAX endpoint.
    if(cart.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(cart.attr('style') || ''))return;
    const price=normalize(card.find('.sale-price').text()),raw=price.match(/^(\d{1,3}(?:\.\d{3})*|\d+) Ft$/),amount=raw ? Number(raw[1].replace(/\./g,'')) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('img.main-image').attr('data-src') || '');if(candidate.origin==='https://reflexshop.hu' && candidate.pathname.startsWith('/img/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    const stock=normalize(card.find('.stock-status').text());
    products.push({externalID:id,sku:id,title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(stock) ? 'preorder' : /^Raktáron$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if(new Set(cardIDs).size!==total)throw new Error('Duplikált Reflexshop terméklista.');
  return {products,total,cardIDs};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanReflexshop(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://reflexshop.hu/robots.txt',signal);if(!/user-agent:/i.test(source))throw new Error('A Reflexshop robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  signal.throwIfAborted();const url=reflexshopFetchUrl(REFLEXSHOP_URL),gate=robotsPermission(robots.source,url.pathname+url.search);
  if(!gate.allowed)throw new Error('A Reflexshop robots.txt nem engedi a keresés lekérését.');
  await wait(gate.delayMs,signal);const parsed=parseReflexshopPage(await download(url.href,signal));
  return {products:parsed.products,total:parsed.products.length,pages:1,scannedAt:Date.now()};
}
