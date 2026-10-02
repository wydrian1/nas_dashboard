import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { GRANDLINE_CATALOG_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, grandlineFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const GRANDLINE_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function grandlineProductUrl(input:string):string {
  const url=new URL(input,'https://www.grandline.hu');
  if(url.origin!=='https://www.grandline.hu' || url.username || url.password || !/^\/[a-z0-9-]+\/$/i.test(url.pathname) || ['/pokemon/','/kosar/','/bejelentkezes/','/regisztracio/','/admin/'].includes(url.pathname.toLowerCase()))throw new Error('Érvénytelen GrandLine terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseGrandlinePage(html:string,expectedPage=1) {
  const $=load(html),expectedUrl=expectedPage===1 ? GRANDLINE_CATALOG_URL : `${GRANDLINE_CATALOG_URL}oldal-${expectedPage}/`;
  const canonical=$('link[rel="canonical"]').attr('href');
  // Shoptet emits a canonical only on page 1; later pages identify themselves via prev/next.
  if(!$('body.type-category.in-pokemon.id-811').length || !/pok[eé]mon/i.test($('h1').first().text()) || (expectedPage===1 ? canonical!==expectedUrl : canonical!==undefined && canonical!==expectedUrl) || !$('#stock[name="stock"]').length || $('#stock').is('[checked]'))throw new Error('A GrandLine nyilvános Pokémon-kategóriája vagy oldalszáma nem ismerhető fel.');
  const summary=normalize($('.category-header-pagination').text()).match(/^Oldal (\d+)\/\s*(\d+)\s*-\s*összesen (\d+) termék$/i);
  if(!summary)throw new Error('A GrandLine termékszáma vagy lapozása nem olvasható.');
  const [page,pageCount,total]=summary.slice(1).map(Number);
  if(page!==expectedPage || pageCount<1 || pageCount>50 || total>600 || page>pageCount || (total===0 && pageCount!==1))throw new Error('Érvénytelen GrandLine lapozási adatok.');
  const pageUrl=(number:number)=>number===1 ? GRANDLINE_CATALOG_URL : `${GRANDLINE_CATALOG_URL}oldal-${number}/`;
  const prev=$('head link[rel="prev"]').attr('href'),next=$('head link[rel="next"]').attr('href');
  if((page>1 && (!prev || new URL(prev,expectedUrl).href!==pageUrl(page-1))) || (page<pageCount && (!next || new URL(next,expectedUrl).href!==pageUrl(page+1))) || (page===pageCount && next))throw new Error('Hiányos vagy hibás GrandLine lapozási hivatkozások.');
  if(total>0 && normalize($('.pagination__currentPage').text())!==String(page))throw new Error('A GrandLine aktuális lapozóoldala nem egyezik.');
  const grid=$('#products.products-block');
  if(grid.length!==1)throw new Error('Nem felismerhető GrandLine terméklista.');
  const cards=grid.children('.product'),products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),item=card.children('.p[data-micro="product"]'),id=item.attr('data-micro-product-id') || '',link=item.find('a.name[data-micro="url"]');
    if(item.length!==1 || !/^[1-9]\d*$/.test(id) || link.length!==1 || !link.attr('href'))throw new Error('Hiányos GrandLine termékkártya.');
    const title=normalize(link.text()),url=grandlineProductUrl(link.attr('href')!);
    if(!title || title.length>500)throw new Error('Hiányzó GrandLine terméknév.');
    cardIDs.push(id);
    const button=item.find('.p-tools button.btn-cart');
    if(!button.length && item.find('.p-tools form[action="/action/Cart/addCartItem/"]').length)throw new Error('A GrandLine kosárgomb-szerkezete megváltozott.');
    if(!button.length || button.is('.disabled,[disabled],[aria-disabled="true"],[hidden]'))return;
    const form=button.closest('form');
    if(button.length!==1 || button.attr('type')!=='submit' || !/kosárba/i.test(normalize(button.text())) || form.attr('action')!=='/action/Cart/addCartItem/' || form.attr('method')?.toLowerCase()!=='post' || form.find('input[name="productId"]').attr('value')!==id || form.find('input[name="productId"]').length!==1)throw new Error('Nem felismerhető GrandLine kosárgomb vagy termékazonosító.');
    if(button.closest('[disabled],fieldset[disabled]').length)return;
    const offer=item.find('[data-micro="offer"]'),rawPrice=offer.attr('data-micro-price');
    const amount=offer.attr('data-micro-price-currency')==='HUF' && rawPrice && /^\d+(\.\d+)?$/.test(rawPrice) ? Math.round(Number(rawPrice)) : NaN;
    const img=item.find('a.image img').first();let image:string|null=null;
    try{const candidate=new URL((img.attr('data-src') || img.attr('src') || '').trim());if(candidate.origin==='https://cdn.myshoptet.com' && candidate.pathname.startsWith('/usr/www.grandline.hu/user/shop/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image; data: placeholders are never rendered. */}
    const stock=normalize(item.find('.availability > span').first().text());
    products.push({externalID:id,sku:normalize(item.find('[data-micro="sku"]').text()).slice(0,100),title,url,image,
      priceHuf:Number.isFinite(amount) && amount>=0 && amount<=100_000_000 ? amount : null,
      availability:/előrendel/i.test(stock) ? 'preorder' : /^raktáron$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if((total>0 && !cards.length) || (pageCount===1 && cards.length!==total) || cards.length>total || new Set(cardIDs).size!==cardIDs.length)throw new Error('Hiányos vagy duplikált GrandLine terméklista.');
  return {products,cardIDs,cardCount:cards.length,page,pageCount,total};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanGrandline(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){
    const source=await download('https://www.grandline.hu/robots.txt',signal);
    if(!/user-agent:/i.test(source))throw new Error('A GrandLine robots.txt nem értelmezhető.');
    robots={source,time:Date.now()};if(!options.download)robotsCache=robots;
  }
  const products:PokemonProduct[]=[],seen=new Set<string>();let total:number|undefined,pageCount:number|undefined,pageSize=0,cards=0;
  for(let page=1;page<=50;page++){
    signal.throwIfAborted();
    // Never request stock=1 (robots-disallowed), reorder filter parameters, or call cart/API routes.
    const url=grandlineFetchUrl(page===1 ? GRANDLINE_CATALOG_URL : `${GRANDLINE_CATALOG_URL}oldal-${page}/`);
    const gate=robotsPermission(robots.source,url.pathname);
    if(!gate.allowed)throw new Error('A GrandLine robots.txt nem engedi ezt a lekérést.');
    await wait(gate.delayMs,signal);
    const parsed=parseGrandlinePage(await download(url.href,signal),page);
    if(total!==undefined && (parsed.total!==total || parsed.pageCount!==pageCount))throw new Error('A GrandLine kínálata vagy lapozása megváltozott vizsgálat közben.');
    total=parsed.total;pageCount=parsed.pageCount;if(page===1)pageSize=parsed.cardCount;
    if(total>0 && (Math.ceil(total/pageSize)!==pageCount || parsed.cardCount!==Math.min(pageSize,total-(page-1)*pageSize)))throw new Error('Nem teljes vagy nem folytonos GrandLine lapozás.');
    for(const id of parsed.cardIDs){if(seen.has(id))throw new Error('Ismételt GrandLine termékkártya lapozás közben.');seen.add(id);}
    cards+=parsed.cardCount;products.push(...parsed.products);
    if(page===pageCount){if(cards!==total)throw new Error('Nem teljes GrandLine kategóriavizsgálat.');return {products,total:products.length,pages:page,scannedAt:Date.now()};}
  }
  throw new Error('A GrandLine vizsgálat elérte a lapozási korlátot.');
}
