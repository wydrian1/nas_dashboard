import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { pinnedAddressOptions } from "../feed-download.ts";
import { isPublicAddress } from "../url-policy.ts";
import {interruptionRedirect,type ShopFailureKind} from './health.ts';
import { MYTHGAMES_COLLECTION, POTTYOSZEBRA_CATEGORY, KRODOMCARDS_FILTER, RTCOLLECTORSCLUB_COLLECTION, CARDVERSE_CATEGORY, METAGAMES_CATEGORY, TCGBOLT_CATEGORY, BLOOMRIFT_CATEGORY, ALZA_CATEGORY } from "./types.ts";

export class ShopRequestError extends Error {
  retryAfterMs: number;
  kind:ShopFailureKind;
  constructor(message: string, retryAfterMs=0,kind:ShopFailureKind='error') {super(message);this.retryAfterMs=retryAfterMs;this.kind=kind;}
}
export function gamerunnerFetchUrl(input: string): URL {
  const url=new URL(input);
  if (url.origin!=="https://gamerunner.hu" || url.username || url.password || !["/robots.txt","/gyujtogetos-kartyajatekok/pokemon-tcg"].includes(url.pathname)) throw new ShopRequestError("Nem engedélyezett webshopcím.");
  if (url.pathname!=="/robots.txt" && (url.searchParams.get("stockfilter")!=="1" || [...url.searchParams.keys()].some(key=>!["stockfilter","page"].includes(key)))) throw new ShopRequestError("Érvénytelen készletszűrő.");
  const page=url.searchParams.get("page");
  if (page && (!/^\d+$/.test(page) || Number(page)<1 || Number(page)>50)) throw new ShopRequestError("Érvénytelen lapozás.");
  return url;
}
export async function downloadShopPage(input: string, signal: AbortSignal, redirects=0): Promise<string> {
  const url=shopFetchUrl(input);
  const addresses=await lookup(url.hostname,{all:true});
  if (!addresses.length || addresses.some(address=>!isPublicAddress(address.address))) throw new ShopRequestError("A webshop DNS-címe nem nyilvános.");
  const response=await new Promise<{body:string;location?:string}>((resolve,reject)=>{
    const req=request(url,{
      ...pinnedAddressOptions(addresses[0]),
      signal:AbortSignal.any([signal,AbortSignal.timeout(20_000)]),
      headers:{"User-Agent":"WydrianMonitor/1.0 (personal stock monitor)",Accept:"text/html,text/plain;q=0.9","Accept-Encoding":"identity"}
    },res=>{
      if ([301,302,303,307,308].includes(res.statusCode || 0)) {
        res.resume();
        if (!res.headers.location) {reject(new ShopRequestError("Hiányzó átirányítás."));return;}
        resolve({body:"",location:res.headers.location});return;
      }
      if (res.statusCode!==200) {
        res.resume();
        const value=res.headers["retry-after"];
        const retry=typeof value==="string" ? (/^\d+$/.test(value) ? Number(value)*1000 : Math.max(0,Date.parse(value)-Date.now())) : 0;
        const kind=res.statusCode===403?'protected':res.statusCode===429?'rate_limited':'error';
        reject(new ShopRequestError(`A webshop HTTP ${res.statusCode || "hiba"} választ adott.`,Number.isFinite(retry)?retry:0,kind));return;
      }
      const chunks:Buffer[]=[];let size=0;
      res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>3*1024*1024)req.destroy(new ShopRequestError("Túl nagy webshopoldal."));else chunks.push(chunk);});
      res.on("end",()=>resolve({body:Buffer.concat(chunks).toString("utf8")}));
      res.on("error",reject);res.on("aborted",()=>reject(new ShopRequestError("Megszakadt a webshopoldal letöltése.")));
    });
    req.on("error",reject);req.end();
  });
  if (response.location) {
    if (redirects>=3) throw new ShopRequestError("Túl sok webshop-átirányítás.");
    const target=new URL(response.location,url);
    if(target.origin!==url.origin)throw new ShopRequestError("Másik webshopra történő átirányítás nem engedélyezett.");
    const interruption=interruptionRedirect(target);
    if(interruption)throw new ShopRequestError(interruption==='maintenance'?'A webshop karbantartási oldalra irányít; a korábbi készlet nem aktuális.':'A webshop hozzáférésvédelmet kér; ezt nem kerüljük meg.',15*60_000,interruption);
    return downloadShopPage(target.href,signal,redirects+1);
  }
  return response.body;
}
export function mythgamesFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=="https://mythgames.eu" || url.username || url.password || url.hash)throw new ShopRequestError("Nem engedélyezett MythGames-cím.");
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError("Érvénytelen robots-cím.");return url;}
  if(url.pathname===MYTHGAMES_COLLECTION){
    if(url.searchParams.get('filter.v.availability')!=='1' || [...url.searchParams.keys()].some(key=>!['filter.v.availability','page'].includes(key)))throw new ShopRequestError("Nem engedélyezett MythGames-szűrő vagy rendezés.");
    const page=url.searchParams.get('page');if(page && (!/^\d+$/.test(page) || Number(page)<1 || Number(page)>50))throw new ShopRequestError("Érvénytelen MythGames-lapozás.");
  }else throw new ShopRequestError("Nem engedélyezett MythGames-útvonal.");
  if([...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))throw new ShopRequestError("Duplikált MythGames-paraméter.");
  return url;
}
export function shopFetchUrl(input:string):URL {
  const origin=new URL(input).origin;
  if(origin==='https://m.alza.hu')return alzaFetchUrl(input);
  if(origin==='https://mythgames.eu')return mythgamesFetchUrl(input);
  if(origin==='https://pottyoszebra.hu')return pottyoszebraFetchUrl(input);
  if(origin==='https://www.grandline.hu')return grandlineFetchUrl(input);
  if(origin==='https://www.krodomcards.hu')return krodomcardsFetchUrl(input);
  if(origin==='https://www.jateknet.hu')return jateknetFetchUrl(input);
  if(origin==='https://reflexshop.hu')return reflexshopFetchUrl(input);
  if(origin==='https://geekempire.hu')return geekempireFetchUrl(input);
  if(origin==='https://tcgfutar.hu')return tcgfutarFetchUrl(input);
  if(origin==='https://sportkartyabolt.hu')return sportkartyaboltFetchUrl(input);
  if(origin==='https://rtcollectorsclub.com')return rtcollectorsclubFetchUrl(input);
  if(origin==='https://www.cardverse.hu')return cardverseFetchUrl(input);
  if(origin==='https://www.metagames.hu')return metagamesFetchUrl(input);
  if(origin==='https://tcgbolt.hu')return tcgboltFetchUrl(input);
  if(origin==='https://bloomrift.eu')return bloomriftFetchUrl(input);
  return gamerunnerFetchUrl(input);
}
export function alzaFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://m.alza.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett Alza-cím.');
  if(url.pathname!==ALZA_CATEGORY || url.searchParams.get('availabilityFilterValue')!=='2' || [...url.searchParams.keys()].length!==1 || url.searchParams.getAll('availabilityFilterValue').length!==1)throw new ShopRequestError('Nem igazolt Alza-készletszűrő vagy lapozás.');
  return url;
}
export function pottyoszebraFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://pottyoszebra.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett Pöttyös Zebra cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!==POTTYOSZEBRA_CATEGORY || url.searchParams.get('stockfilter')!=='1' || [...url.searchParams.keys()].some(key=>!['stockfilter','page'].includes(key) || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Érvénytelen Pöttyös Zebra kategória vagy készletszűrő.');
  const page=url.searchParams.get('page');
  if(page && (!/^\d+$/.test(page) || Number(page)<1 || Number(page)>50))throw new ShopRequestError('Érvénytelen Pöttyös Zebra lapozás.');
  return url;
}
export function grandlineFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://www.grandline.hu' || url.username || url.password || url.hash || url.search)throw new ShopRequestError('Nem engedélyezett GrandLine-cím vagy szűrő.');
  if(['/robots.txt','/pokemon/'].includes(url.pathname))return url;
  const page=url.pathname.match(/^\/pokemon\/oldal-([1-9]\d*)\/$/);
  if(!page || Number(page[1])<2 || Number(page[1])>50)throw new ShopRequestError('Nem engedélyezett GrandLine-útvonal vagy lapozás.');
  return url;
}
export function krodomcardsFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://www.krodomcards.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett Krodom Cards cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!=='/index.php' || url.searchParams.get('route')!=='filter' || url.searchParams.get('filter')!==KRODOMCARDS_FILTER || [...url.searchParams.keys()].some(key=>!['route','filter','page'].includes(key) || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Érvénytelen Krodom Cards szűrő vagy útvonal.');
  const page=url.searchParams.get('page');
  if(page!==null && (!/^\d+$/.test(page) || Number(page)<1 || Number(page)>50))throw new ShopRequestError('Érvénytelen Krodom Cards lapozás.');
  return url;
}
export function jateknetFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://www.jateknet.hu' || url.username || url.password || url.hash || url.search || !['/robots.txt','/gyujtheto-kartya'].includes(url.pathname))throw new ShopRequestError('Nem engedélyezett JátékNet-cím vagy szűrő.');
  return url;
}
export function reflexshopFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://reflexshop.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett Reflexshop-cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!=='/shop_search.php' || url.searchParams.get('search')!=='pokemon tcg' || url.searchParams.get('filter')!=='product_status:in_stock' || [...url.searchParams.keys()].some(key=>!['search','filter'].includes(key) || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Nem engedélyezett Reflexshop-keresés vagy szűrő.');
  return url;
}
export function geekempireFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://geekempire.hu' || url.username || url.password || url.hash || url.search || !['/robots.txt','/termekkategoria/kartya/pokemon-kartya/'].includes(url.pathname))throw new ShopRequestError('Nem engedélyezett GeekEmpire-cím vagy szűrő.');
  return url;
}
export function tcgfutarFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://tcgfutar.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett TCG Futár cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!=='/spl/100003/Pokemon-TCG' || [...url.searchParams.keys()].some(key=>key!=='infinite_page' || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Nem engedélyezett TCG Futár kategória vagy szűrő.');
  const page=url.searchParams.get('infinite_page');if(page!==null && (!/^[1-9]\d*$/.test(page) || Number(page)>50))throw new ShopRequestError('Érvénytelen TCG Futár lapozás.');
  return url;
}
export function sportkartyaboltFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://sportkartyabolt.hu' || url.username || url.password || url.hash || url.search || !['/robots.txt','/Pokemon-Kartya'].includes(url.pathname))throw new ShopRequestError('Nem engedélyezett Sport Kártya Bolt cím vagy szűrő.');
  return url;
}
export function rtcollectorsclubFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://rtcollectorsclub.com' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett RT Collectors Club cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!==RTCOLLECTORSCLUB_COLLECTION || url.searchParams.get('filter.v.availability')!=='1' || [...url.searchParams.keys()].some(key=>!['filter.v.availability','page'].includes(key) || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Nem engedélyezett RT Collectors Club szűrő vagy rendezés.');
  const page=url.searchParams.get('page');if(page!==null && (!/^[1-9]\d*$/.test(page) || Number(page)>50))throw new ShopRequestError('Érvénytelen RT Collectors Club lapozás.');
  return url;
}
export function cardverseFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://www.cardverse.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett Cardverse-cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!==CARDVERSE_CATEGORY || url.searchParams.get('_stock')!=='instock' || url.searchParams.get('_cat')!=='gyujtogetos-kartyajatekok' || url.searchParams.get('_brand')!=='pokemon-tcg' || url.searchParams.get('~1')!=='' || [...url.searchParams.keys()].some(key=>!['_stock','_cat','_brand','~1'].includes(key) || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Nem engedélyezett Cardverse-szűrő vagy útvonal.');
  return url;
}
export function tcgboltFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://tcgbolt.hu' || url.username || url.password || url.hash || url.search)throw new ShopRequestError('Nem engedélyezett TCG Bolt cím vagy paraméter.');
  if(url.pathname==='/robots.txt' || url.pathname===TCGBOLT_CATEGORY)return url;
  const page=url.pathname.match(/^\/termekkategoria\/pokemon\/page\/([1-9]\d*)\/$/);
  if(!page || Number(page[1])>50)throw new ShopRequestError('Nem engedélyezett TCG Bolt kategória vagy lapozás.');
  return url;
}
export function bloomriftFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://bloomrift.eu' || url.username || url.password || url.hash || url.search)throw new ShopRequestError('Nem engedélyezett Bloomrift-cím vagy paraméter.');
  if(url.pathname==='/robots.txt' || url.pathname===BLOOMRIFT_CATEGORY)return url;
  const page=url.pathname.match(/^\/Osszes-angol-termek,([1-9]\d*)$/);
  if(!page || Number(page[1])<2 || Number(page[1])>50)throw new ShopRequestError('Nem engedélyezett Bloomrift-kategória vagy lapozás.');
  return url;
}
export function metagamesFetchUrl(input:string):URL {
  const url=new URL(input);
  if(url.origin!=='https://www.metagames.hu' || url.username || url.password || url.hash)throw new ShopRequestError('Nem engedélyezett Metagames-cím.');
  if(url.pathname==='/robots.txt'){if(url.search)throw new ShopRequestError('Érvénytelen robots-cím.');return url;}
  if(url.pathname!==METAGAMES_CATEGORY || url.searchParams.get('keszlet')!=='csak-keszleten' || [...url.searchParams.keys()].some(key=>!['keszlet','page'].includes(key) || url.searchParams.getAll(key).length!==1))throw new ShopRequestError('Nem engedélyezett Metagames-kategória vagy készletszűrő.');
  const page=url.searchParams.get('page');
  if(page!==null && (!/^(0|[1-9]\d*)$/.test(page) || Number(page)>49))throw new ShopRequestError('Érvénytelen Metagames-lapozás.');
  return url;
}
