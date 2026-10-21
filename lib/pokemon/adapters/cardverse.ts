import { load } from "cheerio";
import { CARDVERSE_URL, CARDVERSE_CATEGORY, type PokemonProduct } from "../types.ts";
import { cardverseFetchUrl } from "../fetch-policy.ts";
import { catalogScanner } from "./catalog-scan.ts";

export const CARDVERSE_ADAPTER_VERSION='2.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function cardverseProductUrl(input:string):string {
  const url=new URL(input,CARDVERSE_URL);
  if(url.origin!=='https://www.cardverse.hu' || url.username || url.password || !/^\/termek\/[a-z0-9-]+\/$/i.test(url.pathname))throw new Error('Érvénytelen Cardverse terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseCardversePage(html:string,expectedPage=1) {
  const $=load(html);
  if(!Number.isInteger(expectedPage) || expectedPage<1 || expectedPage>50 || !$('body.tax-product_cat.term-gyujtogetos-kartyajatekok').length || $('link[rel="canonical"]').length!==1 || $('link[rel="canonical"]').attr('href')!=='https://www.cardverse.hu'+CARDVERSE_CATEGORY)throw new Error('A Cardverse kategória nem ismerhető fel.');
  // JSON assignments only: never eval scripts or request FacetWP's nonce/API endpoints.
  function metadata(name:string){
    const scripts=$('script').toArray().map(e=>$(e).text()).filter(text=>new RegExp('window\\.'+name+'\\s*=').test(text));
    const match=scripts.length===1 ? scripts[0].match(new RegExp('^\\s*window\\.'+name+'\\s*=\\s*(\\{[\\s\\S]*\\})\\s*;\\s*$')) : null;
    if(!match)throw new Error('Hiányzó Cardverse szűrőmetaadat.');
    return JSON.parse(match[1]);
  }
  const http=metadata('FWP_HTTP'),data=metadata('FWP_JSON'),preload=data?.preload_data,pager=preload?.settings?.pager;
  const keys=expectedPage===1 ? ['stock','brands'] : ['stock','brands','paged'];
  if(http?.uri!==CARDVERSE_CATEGORY.slice(1,-1) || !http?.url_vars || Object.keys(http.url_vars).sort().join()!==keys.sort().join() || data?.prefix!=='_')throw new Error('A Cardverse szűrők nem egyeznek.');
  if(!http.get || Object.keys(http.get).sort().join()!==keys.map(key=>'_'+key).sort().join() || keys.some(key=>http.get['_'+key]!==({stock:'instock',brands:'pokemon-tcg',paged:String(expectedPage)} as Record<string,string>)[key]))throw new Error('A Cardverse kérés szűrői nem egyeznek.');
  for(const [name,value] of [['stock','instock'],['brands','pokemon-tcg']]){
    const values=http.url_vars[name],facet=load(typeof preload?.facets?.[name]==='string' ? preload.facets[name] : ''),checked=facet('.facetwp-checkbox.checked');
    if(!Array.isArray(values) || values.length!==1 || values[0]!==value || checked.length!==1 || checked.attr('data-value')!==value)throw new Error('A Cardverse szűrő nem egyezik: '+name);
  }
  if(expectedPage>1 && http.url_vars.paged!==String(expectedPage))throw new Error('Hibás Cardverse oldalszám.');
  if(!pager || pager.page!==expectedPage || !Number.isSafeInteger(pager.per_page) || pager.per_page<1 || pager.per_page>100 || !Number.isSafeInteger(pager.total_rows) || pager.total_rows<0 || pager.total_rows>600 || pager.total_pages!==Math.ceil(pager.total_rows/pager.per_page) || expectedPage>Math.max(1,pager.total_pages))throw new Error('Hibás Cardverse lapozási metaadat.');
  const total=pager.total_rows,grid=$('.products-container > #product-list-wrapper.facetwp-template > ul.products'),cards=grid.children('article.cverse-product');
  if(grid.length!==1 || cards.length!==Math.min(pager.per_page,Math.max(0,total-(expectedPage-1)*pager.per_page)))throw new Error('Hiányos Cardverse lista.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),link=card.children('a.product-link'),title=normalize(link.find('.product-title').text()),button=card.children('a.loop-add-to-cart'),id=button.attr('data-product_id') || '';
    if(!/^[1-9]\d*$/.test(id) || card.find('.product-brand meta[itemprop="name"]').length!==1 || card.find('.product-brand meta[itemprop="name"]').attr('content')!=='Pokémon TCG' || link.length!==1 || !link.attr('href') || !title || title.length>500 || button.length!==1)throw new Error('Hiányos Cardverse termékkártya vagy azonosító.');
    const url=cardverseProductUrl(link.attr('href')!);cardIDs.push(id);
    if(!button.is('.add_to_cart_button') || button.is('.product_type_variable')){
      const details=new URL(button.attr('href') || '',CARDVERSE_URL);if(details.search || details.hash || cardverseProductUrl(details.href)!==url || /^Kosárba:/i.test(button.attr('aria-label') || ''))throw new Error('Ismeretlen Cardverse termékgomb.');return;
    }
    const action=new URL(button.attr('href') || '',CARDVERSE_URL);
    if(!button.is('.product_type_simple') || button.attr('role')!=='button' || !/^Kosárba:/i.test(button.attr('aria-label') || '') || action.searchParams.getAll('add-to-cart').length!==1 || action.searchParams.get('add-to-cart')!==id)throw new Error('Ismeretlen Cardverse kosárgomb vagy cél.');
    action.searchParams.delete('add-to-cart');cardverseFetchUrl(action.href); // Validate only; the original action is robots-forbidden and NEVER requested.
    if(button.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(button.attr('style') || ''))return;
    const raw=card.find('meta[itemprop="price"]').attr('content') || '',currency=card.find('meta[itemprop="priceCurrency"]').attr('content'),amount=currency==='HUF' && /^\d+(?:\.\d+)?$/.test(raw) ? Math.round(Number(raw)) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('img.product-image').attr('src') || '');if(candidate.origin==='https://www.cardverse.hu' && candidate.pathname.startsWith('/wp-content/uploads/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    const stock=card.find('.stock-status');
    if(stock.length!==1 || !stock.is('.stock-is-instock') || normalize(stock.text())!=='Raktáron' || card.find('link[itemprop="availability"]').attr('href')!=='https://schema.org/InStock')throw new Error('Nem igazolt Cardverse készlet.');
    products.push({externalID:id,sku:normalize(button.attr('data-product_sku') || '').slice(0,100),title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:'in_stock'});
  });
  if(new Set(cardIDs).size!==cardIDs.length)throw new Error('Duplikált Cardverse lista.');
  return {products,total,cardIDs};
}
export const scanCardverse=catalogScanner({name:'Cardverse',url:CARDVERSE_URL,policy:cardverseFetchUrl,parse:parseCardversePage,mode:'append',pageParam:'_paged'});
