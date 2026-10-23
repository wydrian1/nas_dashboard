import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import { GEEKEMPIRE_URL, type PokemonProduct, type ShopScan } from "../types.ts";
import { downloadShopPage, geekempireFetchUrl } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";

export const GEEKEMPIRE_ADAPTER_VERSION='1.3.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const pageUrl=(page:number)=>GEEKEMPIRE_URL+(page===1 ? '' : 'page/'+page+'/');
export function geekempireProductUrl(input:string):string {
  const url=new URL(input,GEEKEMPIRE_URL);
  if(url.origin!=='https://geekempire.hu' || url.username || url.password || !/^\/termek\/[a-z0-9-]+\/$/i.test(url.pathname))throw new Error('Érvénytelen GeekEmpire terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseGeekempirePage(html:string,expectedPage=1) {
  const $=load(html),canonical=$('link[rel="canonical"]');
  // The live category has two SEO canonical tags: the requested path and a legacy alias.
  const canonicals=canonical.toArray().map(e=>$(e).attr('href'));
  const legacy='https://geekempire.hu/termekkategoria/pokemon-kartya/'+(expectedPage===1 ? '' : 'page/'+expectedPage+'/');
  if(!Number.isInteger(expectedPage) || expectedPage<1 || expectedPage>50 || !$('body.tax-product_cat.term-pokemon-kartya').length || normalize($('h1').text())!=='Pokémon Kártya' || !canonicals.includes(pageUrl(expectedPage)) || canonicals.length>2 || canonicals.some(href=>![pageUrl(expectedPage),legacy].includes(href || '')))throw new Error('A GeekEmpire Pokémon-kategória vagy aktuális oldala nem ismerhető fel.');
  const summaries=$('.woocommerce-result-count').toArray().map(e=>{const summary=$(e).clone();summary.find('.screen-reader-text').remove();return normalize(summary.text());}),single=summaries[0]?.match(/^Mind a\(z\) (\d+) találat megjelenítve$/),range=summaries[0]?.match(/^(\d+)[–-](\d+) termék, összesen (\d+) db$/);
  const total=range ? Number(range[3]) : single ? Number(single[1]) : NaN,pages=Math.max(1,Math.ceil(total/25)),first=(expectedPage-1)*25+1,last=Math.min(expectedPage*25,total);
  if(!Number.isSafeInteger(total) || total<0 || total>600 || expectedPage>pages || summaries.some(text=>text!==summaries[0]) || (range ? total===0 || Number(range[1])!==first || Number(range[2])!==last : expectedPage!==1 || total>25))throw new Error('A GeekEmpire kategória összesítője hiányos vagy hibás.');
  const nav=$('.woocommerce-pagination');
  if(pages>1){
    const current=nav.find('[aria-current="page"]'),numbered=[expectedPage];
    if(nav.length!==1 || current.length!==1 || normalize(current.text())!==String(expectedPage))throw new Error('Hiányos GeekEmpire lapozás.');
    nav.find('a').each((_,element)=>{
      const link=$(element),url=geekempireFetchUrl(new URL(link.attr('href') || '',GEEKEMPIRE_URL).href),index=url.href===GEEKEMPIRE_URL ? 1 : Number(url.pathname.match(/\/page\/(\d+)\/$/)?.[1]);
      if(!link.is('.page-numbers') || !Number.isInteger(index) || index<1 || index>pages || (link.is('.next') ? index!==expectedPage+1 : link.is('.prev') ? index!==expectedPage-1 : normalize(link.text())!==String(index)))throw new Error('Érvénytelen GeekEmpire lapozási cél.');
      if(!link.is('.next,.prev'))numbered.push(index);
    });
    if(!numbered.includes(pages) || new Set(numbered).size!==numbered.length || nav.find('a.next').length!==(expectedPage<pages?1:0) || nav.find('a.prev').length!==(expectedPage>1?1:0))throw new Error('Nem igazolt GeekEmpire utolsó/következő oldal.');
  }else if(nav.length)throw new Error('Váratlan GeekEmpire lapozás.');
  const lists=$('ul.products'),cards=lists.children('li.product');
  if(lists.length!==1 || cards.length!==Math.max(0,last-first+1))throw new Error('Hiányos GeekEmpire terméklista.');
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
    if(button.length===1 && /^Hamarosan$/i.test(normalize(button.text()))){
      const details=new URL(button.attr('href') || '',GEEKEMPIRE_URL);
      if(!button.is('.product_type_simple') || button.is('.add_to_cart_button') || (button.attr('data-product_id')!==undefined && button.attr('data-product_id')!==id) || details.search || details.hash || geekempireProductUrl(details.href)!==url)throw new Error('Nem felismerhető GeekEmpire Hamarosan gomb.');
      return; // Coming-soon details links omit cart IDs; stock text alone does not make them purchasable.
    }
    if(button.length!==1 || button.attr('data-product_id')!==id)throw new Error('Hiányos GeekEmpire termékkártya vagy azonosító.');
    if(!button.is('.add_to_cart_button') || button.is('.product_type_variable')){
      const details=new URL(button.attr('href') || '',GEEKEMPIRE_URL);
      if(details.search || details.hash || geekempireProductUrl(details.href)!==url || /kosárba/i.test(normalize(button.text())))throw new Error('Nem felismerhető GeekEmpire termékgomb.');
      return; // Variable/options and unavailable details-only cards are not active cart buttons.
    }
    const action=new URL(button.attr('href') || '',GEEKEMPIRE_URL);
    if(!button.is('.product_type_simple') || !/^Kosárba$/i.test(normalize(button.text())) || action.origin!=='https://geekempire.hu' || action.username || action.password || action.pathname!==new URL(pageUrl(expectedPage)).pathname || action.hash || action.searchParams.get('add-to-cart')!==id || [...action.searchParams.keys()].some(key=>key!=='add-to-cart' || action.searchParams.getAll(key).length!==1))throw new Error('Nem felismerhető GeekEmpire kosárgomb vagy cél.');
    if(reserved || button.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(button.attr('style') || ''))return;
    const amountElement=card.find('.price ins .woocommerce-Price-amount').length ? card.find('.price ins .woocommerce-Price-amount').last() : card.find('.price .woocommerce-Price-amount').last();
    const price=normalize(amountElement.text()),raw=price.match(/^([\d ]+) Ft$/),amount=raw ? Number(raw[1].replace(/ /g,'')) : NaN;
    let image:string|null=null;
    try{const img=link.find('img.attachment-woocommerce_thumbnail'),candidate=new URL(img.attr('data-src') || img.attr('src') || '');if(candidate.origin==='https://geekempire.hu' && candidate.pathname.startsWith('/wp-content/uploads/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    products.push({externalID:id,sku:normalize(button.attr('data-product_sku') || '').slice(0,100),title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(stock) ? 'preorder' : /^Készleten$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if(new Set(cardIDs).size!==cards.length)throw new Error('Duplikált GeekEmpire terméklista.');
  return {products,total,cardIDs,pages};
}
let robotsCache:{source:string;time:number}|undefined;
export async function scanGeekempire(signal:AbortSignal,options:{download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>}={}):Promise<ShopScan> {
  const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
  let robots=robotsCache;
  if(options.download || !robots || Date.now()-robots.time>24*60*60_000){const source=await download('https://geekempire.hu/robots.txt',signal);if(/<\/?[a-z][^>]*>/i.test(source) || !/^User-agent:/im.test(source))throw new Error('A GeekEmpire robots.txt nem értelmezhető.');robots={source,time:Date.now()};if(!options.download)robotsCache=robots;}
  async function page(index:number){
    signal.throwIfAborted();const url=geekempireFetchUrl(pageUrl(index)),gate=robotsPermission(robots!.source,url.pathname);
    if(!gate.allowed)throw new Error('A GeekEmpire robots.txt nem engedi a kategória lekérését.');
    await wait(gate.delayMs,signal);return parseGeekempirePage(await download(url.href,signal),index);
  }
  const first=await page(1),products=[...first.products],ids=[...first.cardIDs];
  for(let index=2;index<=first.pages;index++){
    const current=await page(index);
    if(current.total!==first.total || current.pages!==first.pages)throw new Error('A GeekEmpire termékszáma megváltozott lapozás közben.');
    ids.push(...current.cardIDs);products.push(...current.products);
    if(new Set(ids).size!==ids.length)throw new Error('Ismételt GeekEmpire lapozási eredmény.');
  }
  if(ids.length!==first.total)throw new Error('Nem teljes GeekEmpire vizsgálat.');
  if(first.pages>1){const head=await page(1);if(JSON.stringify(head)!==JSON.stringify(first))throw new Error('A GeekEmpire lista eleje megváltozott lapozás közben.');}
  return {products,total:products.length,pages:first.pages,scannedAt:Date.now()};
}
