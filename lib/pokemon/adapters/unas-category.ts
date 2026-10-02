import { load } from "cheerio";
import type { PokemonProduct } from "../types.ts";
import type { CatalogPage } from "./catalog-scan.ts";

const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function unasCategoryProductUrl(input:string,origin:string,sku:string,spd:boolean):string {
  const url=new URL(input,origin);
  const slug=/^\/[a-z0-9-]+$/i.test(url.pathname),productPath=spd && new RegExp('^/spd/'+sku+'/[a-z0-9-]+$','i').test(url.pathname);
  if(url.origin!==origin || url.username || url.password || (!slug && !productPath))throw new Error('Érvénytelen UNAS terméklink.');
  url.search='';url.hash='';return url.href;
}
export function parseUnasCategory(html:string,config:{name:string;url:string;heading:string;spd:boolean},page=1):CatalogPage {
  const $=load(html),canonical=$('link[rel="canonical"]'),origin=new URL(config.url).origin;
  if(canonical.length!==1 || canonical.attr('href')!==config.url || normalize($('h1').first().text())!==config.heading)throw new Error(config.name+' kategóriája nem ismerhető fel.');
  const counters=$('.paging-sorting-ordering .product-num').toArray().map(e=>normalize($(e).text()));
  if(!counters.length || !/^\d+$/.test(counters[0]) || counters.some(text=>text!==counters[0]))throw new Error(config.name+' termékszáma nem olvasható.');
  const total=Number(counters[0]),lists=$('.page_artlist_list.products'),cards=lists.children('article.product');
  if(lists.length!==1 || total>600 || cards.length>total || (total>0 && !cards.length))throw new Error(config.name+' hiányos terméklista.');
  if(config.spd){
    const scroll=$('script').toArray().map(e=>$(e).text()).join('\n').match(/\bvar infinite_scroll_num=(\d+);/g);
    // UNAS omits the scroll script once the cumulative view contains every card.
    if((cards.length<total && !scroll) || (scroll && (scroll.length!==1 || scroll[0]!==`var infinite_scroll_num=${page};`)))throw new Error(config.name+' kumulatív oldalszáma nem egyezik.');
  }else{
    const starts=$('.product-num__start').toArray().map(e=>normalize($(e).text())),ends=$('.product-num__end').toArray().map(e=>normalize($(e).text()));
    if(!starts.length || !ends.length || starts.some(text=>text!=='1') || ends.some(text=>text!==String(total)))throw new Error(config.name+' kategória nem teljes vagy többoldalas.');
  }
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_index,element)=>{
    const card=$(element),sku=card.attr('data-sku') || '',encoded=sku.replace(/-/g,'__unas__'),link=card.find('a.product__name-link'),title=normalize(link.text()),cart=card.find('button.product__cart-btn');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(sku) || sku.length>100 || card.attr('id')!=='page_artlist_artlist_'+encoded || link.length!==1 || link.attr('data-sku')!==sku || !link.attr('href') || !title || title.length>500)throw new Error(config.name+' hiányos termékkártya vagy SKU.');
    const url=unasCategoryProductUrl(link.attr('href')!,origin,sku,config.spd);cardIDs.push(sku);
    if(!cart.length){
      if(card.find('.not-stock__text').length!==1 || normalize(card.find('.not-stock__text').text())!=='Nincs raktáron' || card.find('.product__main-btn').length)throw new Error(config.name+' ismeretlen kosárgombállapot.');
      return; // A recognized unavailable card has no cart button; stock words alone are never sufficient.
    }
    const qty=card.find(`input[name="db_artlist_${encoded}"]`);
    if(cart.length!==1 || normalize(cart.text())!=='Kosárba' || cart.attr('type')!=='button' || cart.attr('onclick')!==`cart_add('${encoded}','artlist_');` || qty.length!==1)throw new Error(config.name+' kosárgombja vagy azonosítója nem egyezik.');
    if(cart.is('.disabled,[disabled],[aria-disabled="true"],[hidden]') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(cart.attr('style') || ''))return;
    const prices=card.find('.product__prices'),sale=prices.find('.product__price-sale'),price=normalize((sale.length ? sale : prices.find('.product__price-base')).text()),raw=price.match(/^([\d ]+) Ft$/),amount=raw ? Number(raw[1].replace(/ /g,'')) : NaN;
    let image:string|null=null;
    try{const img=card.find('img.js-main-img'),candidate=new URL(img.attr('data-src') || '');if(candidate.origin===origin && candidate.pathname.startsWith('/img/') && !candidate.username && !candidate.password)image=candidate.href;}catch{/* Optional image. */}
    const stock=normalize(card.find('.product__stock-text').text());
    products.push({externalID:sku,sku,title,url,image,priceHuf:Number.isSafeInteger(amount) && amount>=0 && amount<=100_000_000 ? amount : null,availability:/előrendel/i.test(stock) ? 'preorder' : /^Raktáron(?: \([1-9]\d* db\))?$/i.test(stock) ? 'in_stock' : 'available'});
  });
  if(new Set(cardIDs).size!==cardIDs.length)throw new Error(config.name+' duplikált SKU-lista.');
  return {products,total,cardIDs};
}
