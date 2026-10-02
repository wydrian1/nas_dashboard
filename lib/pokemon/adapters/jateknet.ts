import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { JATEKNET_URL, JATEKNET_CATALOG_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, jateknetFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const JATEKNET_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const isPokemon=(text:string)=>/^pokemon\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
export function jateknetProductUrl(input:string,id:string):string {
  const url=new URL(input,JATEKNET_CATALOG_URL);
  if(url.origin!=='https://www.jateknet.hu' || url.username || url.password || !/^[1-9]\d*$/.test(id) || !/^\/[a-z0-9-]+-[1-9]\d*$/i.test(url.pathname) || !url.pathname.endsWith('-'+id))throw new Error('Érvénytelen JátékNet terméklink vagy azonosító.');
  url.search='';url.hash='';return url.href;
}
export function parseJateknetPage(html:string) {
  const $=load(html),root=$('.page-search[data-gtm-list="Category - Gyűjthető kártya"]');
  if(root.length!==1 || normalize(root.find('.products-search-result h1').first().text())!=='Gyűjthető kártya')throw new Error('A JátékNet kategória nem ismerhető fel.');
  const totals=root.find('.search-browse-num span').toArray().map(e=>normalize($(e).text()));
  if(!totals.length || !/^\d+$/.test(totals[0]) || totals.some(text=>text!==totals[0]))throw new Error('A JátékNet teljes termékszáma nem olvasható.');
  const total=Number(totals[0]);if(total>600)throw new Error('Túl nagy JátékNet kategória.');
  const facets=$(`a[href="${JATEKNET_URL}"]`).toArray().map(e=>normalize($(e).text()));
  const facet=facets[0]?.match(/^Pokémon \((\d+)\)$/);
  if(!facet || facets.some(text=>text!==facets[0]))throw new Error('A JátékNet Pokémon-számláló nem ismerhető fel.');
  const pokemonTotal=Number(facet[1]),list=root.find('.products-search-result .products-list'),cards=list.children('.product-box');
  // Only the observed, complete single-page view is supported. Never treat page one as a complete scan.
  const pager=root.find('.products-search-result .product-pages');
  if(list.length!==1 || cards.length!==total || pager.length!==1 || pager.find('li').length!==1 || normalize(pager.find('li.current').text())!=='1. oldal')throw new Error('A JátékNet kategória nem teljes vagy többoldalas; a korábbi állapot megmarad.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];let matched=0;
  cards.each((_index,element)=>{
    const card=$(element),id=card.attr('data-pid') || '',link=card.find('a.product-name'),title=normalize(link.text());
    if(link.length!==1 || !title || title.length>500 || !link.attr('href'))throw new Error('Hiányos JátékNet termékkártya.');
    const url=jateknetProductUrl(link.attr('href')!,id),input=card.find('input[name="product_id"]'),cart=card.find('button.add-to-cart.addShoppingCart');
    if(input.length!==1 || input.attr('value')!==id || cart.length!==1 || !/^Kosárba$/i.test(normalize(cart.text())))throw new Error('Nem felismerhető JátékNet kosárgomb vagy termékazonosító.');
    cardIDs.push(id);
    if(!isPokemon(title))return;
    matched++;
    if(cart.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(cart.attr('style') || ''))return;
    let sku='';try{const data=JSON.parse(card.attr('data-gtm') || '{}');if(String(data.id)!==id)throw new Error();if(typeof data.manufacturer_code==='string')sku=data.manufacturer_code.slice(0,100);}catch{throw new Error('Hiányos JátékNet termékmetaadat.');}
    const price=normalize(card.find('.product-box-price .price-row.price').text()),raw=price.match(/^([\d ]+) Ft$/),amount=raw ? Number(raw[1].replace(/ /g,'')) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('.product-image img').attr('data-src') || '');if(candidate.origin==='https://netjatek.hu' && candidate.pathname.startsWith('/images/common/products/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    const stock=normalize(card.find('.badget-list').text());
    products.push({externalID:id,sku,title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(stock) ? 'preorder' : 'available'});
  });
  if(new Set(cardIDs).size!==total || matched!==pokemonTotal)throw new Error('A JátékNet Pokémon-termékszáma nem egyezik vagy duplikált a lista.');
  return {products,total,cardIDs,pokemonTotal};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanJateknet(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://www.jateknet.hu/robots.txt',signal);if(!/user-agent:/i.test(source))throw new Error('A JátékNet robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  signal.throwIfAborted();const url=jateknetFetchUrl(JATEKNET_CATALOG_URL),gate=robotsPermission(robots.source,url.pathname+url.search);
  if(!gate.allowed)throw new Error('A JátékNet robots.txt nem engedi a kategória lekérését.');
  await wait(gate.delayMs,signal);const parsed=parseJateknetPage(await download(url.href,signal));
  return {products:parsed.products,total:parsed.products.length,pages:1,scannedAt:Date.now()};
}
