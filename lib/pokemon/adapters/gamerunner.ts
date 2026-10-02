import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { GAMERUNNER_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

const normalize=(text:string)=>text.replace(/\s+/g," ").trim();
export function gamerunnerProductUrl(input:string):string {
  const url=new URL(input,"https://gamerunner.hu");
  if(url.origin!=="https://gamerunner.hu" || url.username || url.password || !/^\/[a-z0-9-]+\/?$/i.test(url.pathname) || url.pathname==="/index.php")throw new Error("Érvénytelen GameRunner terméklink.");
  url.search="";url.hash="";return url.href;
}
export function parseGamerunnerPage(html:string) {
  const $=load(html);
  if (!$('body.category-list-body').length || !/pok[eé]mon/i.test($('.page-head-title').first().text()) || !$('#stockfilter-checkbox').is('[checked]')) throw new Error("A GameRunner készletes Pokémon-kategóriája nem ismerhető fel.");
  const summary=normalize($('.sortbar-result-top .results').first().text());
  const range=summary.match(/^(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)\s+termék$/i);
  if (!range) throw new Error("A GameRunner termékszáma vagy lapozása nem olvasható.");
  const [start,end,total]=range.slice(1).map(Number);
  if (total>600 || end>total || (total>0 && (start<1 || end<start))) throw new Error("Érvénytelen GameRunner lapozási adatok.");
  const products:PokemonProduct[]=[];
  $('#snapshot_horizontal > .product-snapshot').each((_index,element)=>{
    const card=$(element), link=card.find('.product-card-title a').first(), cart=card.find('.button-add-to-cart').first();
    const id=String(card.find('input[name="product_id"]').first().attr('value') || "");
    const stock=normalize(card.find('.product-card-stock').text());
    const availability=stock==="Előrendelhető" ? "preorder" : /^(Raktáron|Utolsó [1-9]\d* db raktáron)$/.test(stock) ? "in_stock" : "available";
    if (!/^\d+$/.test(id) || !link.attr('href')) throw new Error("Hiányzó GameRunner termékazonosító vagy link.");
    if (!cart.length || cart.is('.disabled,[disabled],[aria-disabled="true"]')) return;
    if(cart.attr('data-product-id')!==id || !/kosárba/i.test(normalize(cart.text())))throw new Error("Nem felismerhető GameRunner kosárgomb vagy termékazonosító.");
    const title=normalize(link.text());
    if (!title || title.length>500) throw new Error("Hiányzó GameRunner terméknév.");
    const rawPrice=cart.attr('data-price-without-currency');
    const numeric=rawPrice && /^\d+(\.\d+)?$/.test(rawPrice) ? Math.round(Number(rawPrice)) : NaN;
    const image=card.find('.product-card-image img').first().attr('data-src');
    let safeImage:string|null=null;
    try {if(image){const url=new URL(image);if(url.origin==="https://gamerunner.cdn.shoprenter.hu")safeImage=url.href;}}catch{/* Image is optional. */}
    products.push({externalID:id,sku:normalize(cart.attr('data-product-sku') || ""),title,url:gamerunnerProductUrl(link.attr('href') || ""),image:safeImage,priceHuf:Number.isFinite(numeric)&&numeric>=0&&numeric<=100_000_000 ? numeric : null,availability});
  });
  const cardCount=$('#snapshot_horizontal > .product-snapshot').length;
  if(cardCount>0 && !$('#snapshot_horizontal .button-add-to-cart').length)throw new Error("A GameRunner kosárgomb-szerkezete nem ismerhető fel.");
  if (cardCount!==(total===0 ? 0 : end-start+1) || new Set(products.map(product=>product.externalID)).size!==products.length) throw new Error("Hiányos vagy duplikált GameRunner terméklista.");
  return {products,start,end,total,cardCount};
}
let robotsCache:{time:number;source:string}|undefined;
export async function scanGamerunner(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage;
  const wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){
    const source=await download("https://gamerunner.hu/robots.txt",signal);
    if(!/user-agent:/i.test(source))throw new Error("A GameRunner robots.txt nem értelmezhető.");
    robots={time:Date.now(),source};if(!options.download)robotsCache=robots;
  }
  const gate=robotsPermission(robots.source,new URL(GAMERUNNER_URL).pathname+"?stockfilter=1");
  if(!gate.allowed)throw new Error("A GameRunner robots.txt nem engedi ezt a lekérést.");
  const products:PokemonProduct[]=[], seen=new Set<string>();let total:number|undefined;let cards=0;
  for(let page=1;page<=50;page++){
    if(page>1)await wait(gate.delayMs,signal);
    const url=new URL(GAMERUNNER_URL);if(page>1)url.searchParams.set("page",String(page));
    if(!robotsPermission(robots.source,url.pathname+url.search).allowed)throw new Error("A GameRunner robots.txt nem engedi a lapozott lekérést.");
    const parsed=parseGamerunnerPage(await download(url.href,signal));
    if(total!==undefined && parsed.total!==total)throw new Error("A készlet változott lapozás közben; a vizsgálatot újra kell végezni.");
    total=parsed.total;
    if(total>0 && parsed.start!==cards+1)throw new Error("Nem folytonos GameRunner lapozás.");
    cards+=parsed.cardCount;
    for(const product of parsed.products){if(seen.has(product.externalID))throw new Error("Ugyanaz a termék több GameRunner oldalon szerepel.");seen.add(product.externalID);products.push(product);}
    if(parsed.end===total){if(cards!==total)throw new Error("Nem teljes GameRunner vizsgálat.");return {products,total:products.length,pages:page,scannedAt:Date.now()};}
  }
  throw new Error("A GameRunner vizsgálat elérte a lapozási korlátot.");
}
