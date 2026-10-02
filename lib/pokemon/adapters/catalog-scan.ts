import { setTimeout as delay } from "node:timers/promises";
import { downloadShopPage } from "../fetch-policy.ts";
import { robotsPermission } from "../robots.ts";
import type { PokemonProduct, ShopScan } from "../types.ts";

export type CatalogPage={products:PokemonProduct[];total:number;cardIDs:string[]};
export type CatalogScanOptions={download?:typeof downloadShopPage;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>};
// Only static adapters supply this configuration; it is never populated from user URLs or page contents.
export function catalogScanner(config:{name:string;url:string;policy:(input:string)=>URL;parse:(html:string,page:number)=>CatalogPage;mode:'single'|'cumulative'|'append';pageParam?:string;ruleFreeRobots?:boolean}) {
  let robotsCache:{source:string;time:number}|undefined;
  return async(signal:AbortSignal,options:CatalogScanOptions={}):Promise<ShopScan>=>{
    const download=options.download || downloadShopPage,wait=options.wait || ((ms:number,abort:AbortSignal)=>delay(ms,undefined,{signal:abort}));
    let robots=robotsCache;
    if(options.download || !robots || Date.now()-robots.time>24*60*60_000){
      const source=await download(new URL('/robots.txt',config.url).href,signal);
      const ruleFree=config.ruleFreeRobots && /^Sitemap:\s*https:\/\/sportkartyabolt\.hu\/sitemap\.xml\s*$/im.test(source);
      if(/<\/?[a-z][^>]*>/i.test(source) || (!/^User-agent:/im.test(source) && !ruleFree))throw new Error(config.name+' robots.txt nem értelmezhető.');
      robots={source,time:Date.now()};if(!options.download)robotsCache=robots;
    }
    let total:number|undefined,products:PokemonProduct[]=[],ids:string[]=[];
    for(let page=1;page<=50;page++){
      signal.throwIfAborted();const url=new URL(config.url);if(page>1 && config.pageParam)url.searchParams.set(config.pageParam,String(page));config.policy(url.href);
      const gate=robotsPermission(robots.source,url.pathname+url.search);if(!gate.allowed)throw new Error(config.name+' robots.txt nem engedi ezt a lekérést.');
      await wait(gate.delayMs,signal);const parsed=config.parse(await download(url.href,signal),page);
      if(!Number.isSafeInteger(parsed.total) || parsed.total<0 || parsed.total>600 || (total!==undefined && total!==parsed.total))throw new Error(config.name+' termékszáma hibás vagy megváltozott lapozás közben.');
      total=parsed.total;
      if(new Set(parsed.cardIDs).size!==parsed.cardIDs.length || parsed.cardIDs.length>total || (total>0 && !parsed.cardIDs.length))throw new Error(config.name+' hiányos vagy duplikált lista.');
      if(config.mode==='cumulative'){
        if(page>1 && (parsed.cardIDs.length<=ids.length || ids.some((id,index)=>parsed.cardIDs[index]!==id)))throw new Error(config.name+' nem folytonos vagy ismételt kumulatív betöltés.');
        ids=parsed.cardIDs;products=parsed.products;
      }else{ids.push(...parsed.cardIDs);products.push(...parsed.products);}
      if(new Set(ids).size!==ids.length || ids.length>total)throw new Error(config.name+' ismételt lapozási eredmény.');
      if(ids.length===total)return {products,total:products.length,pages:page,scannedAt:Date.now()};
      if(config.mode==='single' || !config.pageParam)throw new Error(config.name+' lista nem teljes vagy többoldalas; a korábbi állapot megmarad.');
    }
    throw new Error(config.name+' vizsgálat elérte a lapozási korlátot.');
  };
}
