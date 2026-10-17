import {load} from 'cheerio';
import {ALZA_URL,ALZA_CATEGORY,type PokemonProduct,type ShopScan} from '../types.ts';
import {alzaFetchUrl,ShopRequestError} from '../fetch-policy.ts';
import {openAlzaBrowser,type AlzaSession} from '../alza-browser.ts';

export const ALZA_ADAPTER_VERSION='1.0.1';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const archive='https://m.alza.hu/jatekok/pokemon-kartyak/a18879069.htm';
const archiveLink=(input:string|undefined)=>input===archive || input===archive+'?availabilityFilterValue=2';
export function alzaProductUrl(input:string,id:string):string {
  const url=new URL(input,ALZA_URL);
  if(url.origin!=='https://m.alza.hu' || url.username || url.password || url.search || url.hash || !/^[1-9]\d*$/.test(id) || !/^\/jatekok\/[a-z0-9-]+-d[1-9]\d*\.htm$/i.test(url.pathname) || !url.pathname.endsWith('-d'+id+'.htm'))throw new Error('Érvénytelen Alza-terméklink vagy azonosító.');
  return url.href;
}
export function alzaImageUrl(input:string):string|null {
  try{
    const url=new URL(input),keys=[...url.searchParams.keys()];
    if(url.origin!=='https://image.alza.cz' || url.username || url.password || url.hash || !/^\/products\/[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(url.pathname))return null;
    // Alza's rendered DOM adds thumbnail dimensions. Accept only bounded, unique
    // width/height values, then store the original image URL without resizing.
    if(new Set(keys).size!==keys.length || keys.some(key=>!['width','height'].includes(key) || !/^[1-9]\d{0,3}$/.test(url.searchParams.get(key)!) || Number(url.searchParams.get(key))>2000))return null;
    url.search='';return url.href;
  }catch{return null;}
}
export function parseAlzaPage(html:string,input=ALZA_URL) {
  if(alzaFetchUrl(input).pathname!==ALZA_CATEGORY)throw new Error('Nem Alza-kategória.');
  const $=load(html),body=$('body').clone();body.find('script,style').remove();
  if(/captcha|access denied|just a moment|verify you are human|checking your browser|biztonsági ellenőrzés|hozzáférés megtagadva/i.test($('title').text()+' '+body.text()))throw new ShopRequestError('Az Alza hozzáférési ellenőrzést kér.',15*60_000,'protected');
  const metadata=$('meta[property="og:url"]');
  if($('#categoryPage').length!==1 || $('h1').length!==1 || normalize($('h1').text())!=='Pokémon kártyák' || metadata.length!==1 || alzaFetchUrl(metadata.attr('content')||'').href!==ALZA_URL || $('.button-filter__count').length!==1 || normalize($('.button-filter__count').text())!=='1')throw new Error('Nem igazolt az Alza mobil Pokémon-kategóriája és készletszűrője.');
  const counters=$('.commodity-count'),match=normalize(counters.text()).match(/^([1-9]\d*) ennyiből: ([1-9]\d*)$/),total=match?Number(match[1]):NaN;
  if(counters.length!==1 || !Number.isSafeInteger(total) || total>600 || Number(match![2])<total)throw new Error('Nem igazolt vagy üres Alza-termékösszesítő.');
  const lists=$('#itemsContainer'),cards=lists.children('.js-box.item');
  if(lists.length!==1 || cards.length!==total || lists.children().length!==total)throw new Error('Hiányos Alza-lista; nem menthető készletként.');
  // Mobile rel=next points to the ARCHIVE even on this complete six-item stock list.
  // Never follow that archive URL. Unknown/real pagination fails closed, not a partial baseline.
  const next=$('link[rel="next"]'),previous=$('link[rel="prev"]'),pager=$('.panel.pager a');
  if(previous.length || next.length>1 || next.length&&!archiveLink(next.attr('href')) || pager.toArray().some(element=>!archiveLink($(element).attr('href')) || normalize($(element).text())!=='Archív'))throw new Error('Nem igazolt Alza-lapozás; részleges lista nem fogadható el.');
  const products:PokemonProduct[]=[],cardIDs:string[]=[];
  cards.each((_,element)=>{
    const card=$(element),id=card.attr('data-id')||'',name=card.find('.item__name'),title=normalize(name.text()),links=card.find('a.item__link-top'),cart=card.find('button.js-buy'),stock=card.find('.item__availability'),stockText=normalize(stock.text());
    if(!/^[1-9]\d*$/.test(id) || name.length!==1 || !title || title.length>500 || links.length!==1 || !links.attr('href') || cart.length!==1 || cart.attr('data-id')!==id || stock.length!==1 || !/^Raktáron(?:\s*[><]?\s*\d+ db)?$/i.test(stockText))throw new Error('Hiányos Alza-termékkártya, készlet vagy kosárgomb.');
    const url=alzaProductUrl(links.attr('href')!,id);cardIDs.push(id);
    const label=cart.clone();label.find('svg,style').remove();if(normalize(label.text())!=='Kosárba')throw new Error('Ismeretlen Alza-kosárgomb.');
    const chain=cart.add(cart.parentsUntil(lists));
    if(chain.toArray().some(node=>$(node).is('.disabled,.hidden,.d-none,[disabled],[hidden],[aria-disabled="true"],[aria-hidden="true"]') || /display\s*:\s*none|visibility\s*:\s*(hidden|collapse)|opacity\s*:\s*0(?:\s|;|$)/i.test($(node).attr('style')||'')))return;
    const prices=card.find('.js-price-withVat'),price=normalize(prices.text()),raw=price.match(/^((?:\d{1,3}(?: \d{3})+|\d+)(?:,\d{1,2})?) Ft$/),amount=raw&&prices.length===1?Number(raw[1].replace(/ /g,'').replace(',','.')):NaN;
    const images=card.find('img.item__image'),image=images.length===1?alzaImageUrl(images.attr('src')||''):null;
    products.push({externalID:id,sku:id,title,url,image,priceHuf:Number.isFinite(amount)&&amount>=0&&amount<=100_000_000?amount:null,availability:'in_stock'});
  });
  if(new Set(cardIDs).size!==cardIDs.length)throw new Error('Duplikált Alza-termékazonosító.');
  return {products,cardIDs,total};
}
export type AlzaScanOptions={open?:(signal:AbortSignal)=>Promise<AlzaSession>};
export async function scanAlza(signal:AbortSignal,options:AlzaScanOptions={}):Promise<ShopScan> {
  signal.throwIfAborted();
  const session=await (options.open||openAlzaBrowser)(signal);
  try{
    // Explicit owner instruction: Alza alone does not fetch or evaluate robots.txt.
    // Actual document rejections/challenges still stop the scan without retry/fallback.
    const url=alzaFetchUrl(ALZA_URL);signal.throwIfAborted();
    const document=await session.read(url.href),parsed=parseAlzaPage(document.html,document.url);
    if(Object.keys(document.cartVisibility).length!==parsed.cardIDs.length || parsed.cardIDs.some(id=>typeof document.cartVisibility[id]!=='boolean'))throw new Error('Hiányos Alza-kosárgomb láthatósági ellenőrzés.');
    const products=parsed.products.filter(product=>document.cartVisibility[product.externalID]);
    if(!products.length)throw new Error('Nem igazolt üres Alza-készlet; az előző állapot megmarad.');
    signal.throwIfAborted();return {products,total:products.length,pages:1,scannedAt:Date.now()};
  }finally{await session.close();}
}
