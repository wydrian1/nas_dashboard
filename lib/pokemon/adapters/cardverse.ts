import { load } from "cheerio";
import { CARDVERSE_URL, CARDVERSE_CATEGORY, type PokemonProduct } from "../types.ts";
import { cardverseFetchUrl } from "../fetch-policy.ts";
import { catalogScanner } from "./catalog-scan.ts";

export const CARDVERSE_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function cardverseProductUrl(input:string):string {
  const url=new URL(input,CARDVERSE_URL);
  if(url.origin!=='https://www.cardverse.hu' || url.username || url.password || !/^\/termek\/[a-z0-9-]+\/$/i.test(url.pathname))throw new Error('Érvénytelen Cardverse terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseCardversePage(html:string) {
  const $=load(html);
  if(!$('body.tax-product_cat.term-gyujtogetos-kartyajatekok').length)throw new Error('A Cardverse kategória nem ismerhető fel.');
  const scripts=$('script').toArray().map(e=>$(e).text()).filter(text=>/window\.searchAndFilterData\s*=/.test(text));
  // Parse the JSON assignment only. Never eval script, hydrate filters, or use its public nonce/API endpoints.
  const match=scripts.length===1 ? scripts[0].match(/^\s*window\.searchAndFilterData\s*=\s*(\{[\s\S]*\});\s*$/) : null;
  if(!match)throw new Error('Hiányzó Cardverse szűrőmetaadat.');
  const data=JSON.parse(match[1]),query=data?.queries?.['1'],settings=query?.settings;
  if(query?.id!==1 || query?.isActive!==true || query?.attributes?.integrationType!=='woocommerce/shop' || settings?.currentTaxonomyArchive!=='product_cat' || settings?.taxonomyArchiveUrl!=='https://www.cardverse.hu'+CARDVERSE_CATEGORY || settings?.currentPage!==1 || settings?.maxPages!==1 || !Number.isSafeInteger(settings?.foundPosts) || settings.foundPosts<0 || settings.foundPosts>600)throw new Error('A Cardverse lista nem teljes, többoldalas vagy hibás metaadatú.');
  if(!data.fields || typeof data.fields!=='object')throw new Error('Hiányzó Cardverse szűrők.');
  const fields=Object.values(data.fields) as {urlName?:string;values?:unknown}[];
  for(const [name,value] of [['stock','instock'],['cat','gyujtogetos-kartyajatekok'],['brand','pokemon-tcg']]){
    const found=fields.filter(field=>field.urlName===name);
    if(found.length!==1 || !Array.isArray(found[0].values) || found[0].values.length!==1 || found[0].values[0]!==value)throw new Error('A Cardverse szűrő nem egyezik: '+name);
  }
  const total=settings.foundPosts,grid=$('.search-filter-query--id-1 > #product-list.sf-product-list'),cards=grid.children('article.cvx-product.product');
  if(grid.length!==1 || cards.length!==total)throw new Error('Hiányos Cardverse lista.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),ids=(card.attr('class') || '').match(/\bpost-([1-9]\d*)\b/g),id=ids?.length===1 ? ids[0].slice(5) : '',link=card.children('a.main-cta-wrapper'),title=normalize(link.find('.cvx-product-title').text()),button=card.children('a.cvx-add-to-cart-loop');
    if(!id || !card.is('.product_cat-gyujtogetos-kartyajatekok') || card.find('meta[itemprop="brand"]').attr('content')!=='Pokémon TCG' || link.length!==1 || !link.attr('href') || !title || title.length>500 || button.length!==1 || button.attr('data-product_id')!==id)throw new Error('Hiányos Cardverse termékkártya vagy azonosító.');
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
    const stock=normalize(card.find('.stock-status').text());products.push({externalID:id,sku:normalize(button.attr('data-product_sku') || '').slice(0,100),title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(stock) ? 'preorder' : /^Készleten$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if(new Set(cardIDs).size!==total)throw new Error('Duplikált Cardverse lista.');
  return {products,total,cardIDs};
}
export const scanCardverse=catalogScanner({name:'Cardverse',url:CARDVERSE_URL,policy:cardverseFetchUrl,parse:parseCardversePage,mode:'single'});
