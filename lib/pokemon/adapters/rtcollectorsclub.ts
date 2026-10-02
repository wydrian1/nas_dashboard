import { load } from "cheerio";
import { RTCOLLECTORSCLUB_COLLECTION, RTCOLLECTORSCLUB_CATALOG_URL, type PokemonProduct } from "../types.ts";
import { rtcollectorsclubFetchUrl } from "../fetch-policy.ts";
import { catalogScanner } from "./catalog-scan.ts";

export const RTCOLLECTORSCLUB_ADAPTER_VERSION='1.0.0';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function rtcollectorsclubProductUrl(input:string):string {
  const url=new URL(input,'https://rtcollectorsclub.com');
  if(url.origin!=='https://rtcollectorsclub.com' || url.username || url.password || !/^\/products\/[a-z0-9-]+$/.test(url.pathname))throw new Error('Érvénytelen RT Collectors Club terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseRtcollectorsclubPage(html:string) {
  const $=load(html),canonical=$('link[rel="canonical"]');
  if(canonical.length!==1 || canonical.attr('href')!=='https://rtcollectorsclub.com'+RTCOLLECTORSCLUB_COLLECTION || normalize($('h1').text())!=='Kollekció: Pokémon Boxok/Tinek')throw new Error('Az RT Collectors Club kategória nem ismerhető fel.');
  const checked=$('input[name="filter.v.availability"][checked]');
  if(!checked.length || checked.toArray().some(e=>$(e).attr('value')!=='1'))throw new Error('Az RT Collectors Club készletszűrő nem egyezik.');
  const counts=$('#ProductCountDesktop,#ProductCount').toArray().map(e=>normalize($(e).text())),count=counts[0]?.match(/^(\d+)\/(\d+) termék$/);
  if(!count || counts.some(text=>text!==counts[0]) || Number(count[2])>600 || Number(count[2])>Number(count[1]))throw new Error('Az RT Collectors Club termékszáma nem olvasható.');
  const total=Number(count[2]),grid=$('ul#product-grid'),cards=grid.children('li');
  if(grid.length!==1 || cards.length>total || (total>0 && !cards.length))throw new Error('Hiányos RT Collectors Club lista.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),links=card.find('a[id^="CardLink-"]'),link=links.first(),id=link.attr('id')?.match(/-(\d+)$/)?.[1] || '',title=normalize(link.text());
    if(links.length!==1 || !/^[1-9]\d*$/.test(id) || !link.attr('href') || !title || title.length>500 || !card.find('.card-wrapper.product-card-wrapper').length || !card.find('[id^="title-"]').attr('id')?.endsWith('-'+id))throw new Error('Hiányos RT Collectors Club termékkártya.');
    const url=rtcollectorsclubProductUrl(link.attr('href')!);cardIDs.push(id);
    const priceRoot=card.find('.card-information .price'),amountText=normalize((priceRoot.is('.price--on-sale') ? priceRoot.find('.price-item--sale') : priceRoot.find('.price__regular .price-item--regular')).first().text()),raw=amountText.match(/^([\d. ]+) Ft$/),amount=raw ? Number(raw[1].replace(/[. ]/g,'')) : NaN;
    let image:string|null=null;
    try{const candidate=new URL(card.find('.card__media img').first().attr('src') || '',url);if(candidate.protocol==='https:' && !candidate.username && !candidate.password && (candidate.origin==='https://rtcollectorsclub.com' && candidate.pathname.startsWith('/cdn/shop/') || candidate.origin==='https://cdn.shopify.com' && candidate.pathname.startsWith('/s/files/')))image=candidate.href;}catch{/* Optional image. */}
    // Explicit user exception: availability-filtered list membership, without cart/variant/product-page checks.
    const badge=normalize(card.find('.card__badge').text());products.push({externalID:id,sku:'',title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel|pre.order/i.test(badge+' '+title) ? 'preorder' : 'available'});
  });
  if(new Set(cardIDs).size!==cardIDs.length)throw new Error('Duplikált RT Collectors Club lista.');
  return {products,total,cardIDs};
}
export const scanRtcollectorsclub=catalogScanner({name:'RT Collectors Club',url:RTCOLLECTORSCLUB_CATALOG_URL,policy:rtcollectorsclubFetchUrl,parse:parseRtcollectorsclubPage,mode:'append',pageParam:'page'});
