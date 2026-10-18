import {load} from 'cheerio';
import {REGIO_URL,type PokemonProduct,type ShopScan} from '../types.ts';
import {regioFetchUrl,ShopRequestError} from '../fetch-policy.ts';
import {openRegioBrowser,type RegioSession} from '../regio-browser.ts';

export const REGIO_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
type RecordValue=Record<string,unknown>;
const object=(value:unknown):RecordValue=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Hiányos REGIO-adat.');return value as RecordValue;};
export function regioProductUrl(input:string,id:string):string{
  const url=new URL(input);if(!/^\d{1,10}$/.test(id)||url.origin!=='https://www.regiojatek.hu'||url.username||url.password||url.search||url.hash||!new RegExp('^/termek-'+id+'-[a-z0-9-]+\\.html$').test(url.pathname))throw new Error('Érvénytelen REGIO-terméklink vagy azonosító.');return url.href;
}
export function regioImageUrl(input:string,id:string):string|null{
  try{const url=new URL(input);return /^\d{1,10}$/.test(id)&&url.origin==='https://www.regiojatek.hu'&&!url.username&&!url.password&&!url.search&&!url.hash&&new RegExp('^/data/regio_images/data/regio_images/preview/'+id+'_\\d+\\.(?:webp|jpg|jpeg|png)$').test(url.pathname)?url.href:null;}catch{return null;}
}
export function parseRegioPage(html:string,raw:unknown,input=REGIO_URL){
  regioFetchUrl(input);const api=object(raw),parameters=object(api.searchParameters),filters=object(parameters.filters),descriptor=object(api.responseDescriptor),status=object(descriptor.responseStatus),$=load(html);
  if(status.responseStatusCode!==0||!Array.isArray(descriptor.errors)||descriptor.errors.length||api.resultStatus!=='resultFound'||parameters.query!=='pokemon'||parameters.page!==1||parameters.resultsPerPage!==30||JSON.stringify(filters.termFilters)!==JSON.stringify([{name:'category',values:['Kártya']}])||JSON.stringify(filters.rangeFilters)!=='[]'||JSON.stringify(filters.geoDistanceFilters)!=='[]')throw new Error('Nem igazolt a REGIO Pokémon-keresése és Kártya kategóriaszűrője.');
  const total=api.count;
  if(typeof total!=='number'||!Number.isSafeInteger(total)||total<1||total>30||api.resultCount!==total||api.pageSize!==30||api.resultPerPage!==30||!Array.isArray(api.documents)||api.documents.length!==total)throw new Error('Nem igazolt teljes egyoldalas REGIO-összesítő.');
  const root=$('#prefixbox-app-container'),cards=root.find('.prefixbox-product-container'),counter=$('#prefixbox-res-counter-box-container .prefixbox-result-text');
  if(root.length!==1||cards.length!==total||root.find('.prefixbox-product-container-wrapper').length!==total||root.find('.prefixbox-product-container-placeholder').length||root.find('[data-product-info]').length!==total||counter.length!==1||normalize(counter.text())!==total+' termék'||$('#paginator').length!==1||$('#paginator').text().trim()||$('#paginator a,#paginator button').length)throw new Error('Hiányos REGIO DOM vagy nem igazolt lapozás; részleges lista nem menthető.');
  const documents=new Map<string,RecordValue>();
  for(const entry of api.documents){const doc=object(object(entry).document),id=doc.identifier;if(typeof id!=='string'||!/^\d{1,10}$/.test(id)||documents.has(id))throw new Error('Duplikált vagy hibás REGIO-azonosító.');documents.set(id,doc);}
  const products:PokemonProduct[]=[],cardIDs:string[]=[];let pokemonCards=0,inStockCards=0;
  cards.each((_,element)=>{
    const card=$(element),data=card.find('[data-product-info]');if(data.length!==1)throw new Error('Hiányos REGIO-termékkártya.');const info=object(JSON.parse(data.attr('data-product-info')!)),id=info.identifier;
    if(typeof id!=='string'||!documents.has(id)||cardIDs.includes(id))throw new Error('Nem egyezik a REGIO megjelenített termékazonosítója.');const doc=documents.get(id)!;cardIDs.push(id);
    for(const key of ['identifier','displayText','url','imageUrl','price','priceValue','availability','category','termekazonosito'])if(info[key]!==doc[key])throw new Error('Nem egyezik a REGIO keresési válasza és termékkártyája.');
    const title=doc.displayText,name=card.find('.pfbx-product-name');if(typeof title!=='string'||!title||title.length>500||name.length!==1||normalize(name.text())!==title||doc.category!=='Kártya'||typeof doc.url!=='string')throw new Error('Hibás REGIO-terméknév vagy kategória.');
    const url=regioProductUrl(doc.url,id),links=card.find('a[href]').toArray().map(link=>$(link).attr('href')!).filter(href=>href!=='#');if(!links.length||links.some(href=>href!==url))throw new Error('Nem egyezik a REGIO-terméklink.');
    // The reviewed search can mix in unrelated promoted card games. Count/validate
    // every card for completeness, but never notify about a non-Pokémon title.
    if(!/\bpokemon\b/.test(title.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()))return;
    pokemonCards++;
    const cart=card.find('.add-to-cart');
    if(doc.availability!=='in stock'){
      if(!['out of stock','available for order'].includes(String(doc.availability))||cart.length||normalize(card.find('.prefixbox-product-cart-container').text())!=='Részletek')throw new Error('Ismeretlen REGIO-elérhetőség vagy kosárállapot.');return;
    }
    inStockCards++;
    if(cart.length!==1||normalize(cart.text())!=='Kosárba'||cart.attr('href')!=='#'||cart.attr('data-cart-product-no')!==id||cart.attr('data-cart-product-id')!==doc.termekazonosito||cart.attr('data-cart-product-name')!==title||typeof doc.termekazonosito!=='string'||!/^\d+$/.test(doc.termekazonosito))throw new Error('Hiányos REGIO-kosárgomb vagy eltérő termékazonosító.');
    if(cart.add(cart.parentsUntil(root)).toArray().some(node=>$(node).is('.disabled,.hidden,.d-none,[disabled],[hidden],[aria-disabled="true"],[aria-hidden="true"]')||/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)|opacity\s*:\s*0(?:\s|;|$)/i.test($(node).attr('style')||'')))return;
    const amount=doc.priceValue,prices=card.find('.product-box-bottom'),text=normalize(prices.text()),price=typeof amount==='number'&&Number.isInteger(amount)&&amount>=0&&amount<=100_000_000&&prices.length===1&&/^\d[\d ]* Ft$/.test(text)&&Number(text.replace(/ Ft$/,'').replaceAll(' ',''))===amount?amount:null;
    const images=card.find('.pfbx-product-img img'),image=images.length===1&&images.attr('src')===doc.imageUrl&&typeof doc.imageUrl==='string'?regioImageUrl(doc.imageUrl,id):null;
    products.push({externalID:id,sku:id,title,url,image,priceHuf:price,availability:'in_stock'});
  });
  if(!pokemonCards)throw new Error('Nincs igazolt Pokémon-termék a REGIO keresésében.');
  if(inStockCards&&!products.length)throw new Error('Minden REGIO-kosárgomb letiltott vagy rejtett; nem igazolt az üres készlet.');
  return {products,cardIDs,total};
}
export async function scanRegio(signal:AbortSignal,options:{open?:(signal:AbortSignal)=>Promise<RegioSession>}={}):Promise<ShopScan>{
  signal.throwIfAborted();const session=await (options.open||openRegioBrowser)(signal);
  try{
    // Explicit owner instruction: REGIO, like Alza, does not request/evaluate robots.txt.
    // No retries, protection bypass, cart interaction or API fallback.
    signal.throwIfAborted();const document=await session.read(),parsed=parseRegioPage(document.html,document.api,document.url);
    if(Object.keys(document.cartVisibility).length!==parsed.cardIDs.length||parsed.cardIDs.some(id=>typeof document.cartVisibility[id]!=='boolean'))throw new Error('Hiányos REGIO-kosárgomb láthatósági ellenőrzés.');
    const products=parsed.products.filter(product=>document.cartVisibility[product.externalID]);
    if(parsed.products.length&&!products.length)throw new ShopRequestError('Minden REGIO-kosárgomb rejtett; nem igazolt az üres készlet.');
    signal.throwIfAborted();return {products,total:products.length,pages:1,scannedAt:Date.now()};
  }finally{await session.close();}
}
