import {lookup} from 'node:dns/promises';
import type {LookupAddress} from 'node:dns';
import type {Page,Browser} from 'playwright';
import {isPublicAddress} from '../url-policy.ts';
import {REGIO_FILTER,REGIO_URL} from './types.ts';
import {regioFetchUrl,ShopRequestError} from './fetch-policy.ts';

// Public page integration/search-box IDs, not credentials or imported session IDs.
export const REGIO_INTEGRATION='/ab5a47df-4d52-4571-90a4-f33892978a66/';
export const REGIO_SEARCH_BOX='07045c9f-bdf7-42f9-bed6-efce7b3fcfd0';
export const REGIO_BROWSER_HOSTS=['www.regiojatek.hu','integration.prefixbox.com','api.prefixbox.com','cdn.jsdelivr.net'] as const;
export type RegioDocument={url:string;html:string;api:unknown;cartVisibility:Record<string,boolean>};
export type RegioSession={read:()=>Promise<RegioDocument>;close:()=>Promise<void>};
const challengeText=/captcha|access denied|just a moment|verify you are human|checking your browser|biztonsági ellenőrzés|hozzáférés megtagadva/i;
async function checkRegioChallenge(page:Page){
  const text=await page.evaluate(()=>document.title+' '+(document.body?.innerText||'').slice(0,12000));
  if(challengeText.test(text))throw new ShopRequestError('A REGIO hozzáférési ellenőrzést kér.',15*60_000,'protected');
}
export function regioSearchRequestUrl(input:string):URL {
  const url=new URL(input),q=url.searchParams,expected={btr:REGIO_SEARCH_BOX,filter:REGIO_FILTER,orderby:'',top:'30',page:'1',useMerchandising:'true',pattern:'pokemon'};
  if(url.origin!=='https://api.prefixbox.com' || url.pathname!=='/search/results/' || url.username || url.password || url.hash || [...q.keys()].length!==10 || Object.entries(expected).some(([key,value])=>q.getAll(key).length!==1 || q.get(key)!==value))throw new ShopRequestError('Nem engedélyezett REGIO nyilvános keresés.');
  for(const key of ['userId','sessionId','customParams'])if(q.getAll(key).length!==1)throw new ShopRequestError('Hiányos REGIO keresési paraméter.');
  for(const key of ['userId','sessionId'])if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(q.get(key)!))throw new ShopRequestError('Ismeretlen REGIO böngészőazonosító.');
  const custom:unknown=JSON.parse(q.get('customParams')!);
  if(JSON.stringify(custom)!==JSON.stringify([{name:'UserId',values:[q.get('userId')]},{name:'SessionId',values:[q.get('sessionId')]}]))throw new ShopRequestError('Ismeretlen REGIO egyéni szűrő.');
  return url;
}
export function regioResourceAllowed(input:string,method:string,type:string):boolean {
  try{
    const url=new URL(input);if(url.protocol!=='https:' || url.username || url.password || url.port || url.hash || !['GET','HEAD'].includes(method))return false;
    if(type==='document'){regioFetchUrl(input);return method==='GET';}
    if(url.hostname==='api.prefixbox.com'){regioSearchRequestUrl(input);return method==='GET'&&['fetch','xhr'].includes(type);}
    if(url.hostname==='integration.prefixbox.com')return method==='GET'&&type==='script'&&url.pathname===REGIO_INTEGRATION&&!url.search;
    if(url.hostname==='cdn.jsdelivr.net')return !url.search&&['script','stylesheet'].includes(type)&&/^\/npm\/nouislider@15\.7\.1\/dist\/nouislider\.min\.(js|css)$/.test(url.pathname);
    return url.hostname==='www.regiojatek.hu'&&['script','stylesheet','font','image','fetch'].includes(type)&&/^\/(?:assets\/(?:js|css|fonts|images|plugins)\/|js\/|data\/regio_images\/)/.test(url.pathname)&&!url.pathname.includes('/analytics');
  }catch{return false;}
}
export async function regioResolverRules(resolve:typeof lookup=lookup,signal=AbortSignal.timeout(10_000)):Promise<string> {
  const rules:string[]=[];
  for(const host of REGIO_BROWSER_HOSTS){
    signal.throwIfAborted();
    const addresses=await new Promise<LookupAddress[]>((done,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});resolve(host,{all:true}).then(done,reject).finally(()=>signal.removeEventListener('abort',abort));});
    if(!addresses.length || addresses.some(value=>!isPublicAddress(value.address)))throw new ShopRequestError('A REGIO böngésző csak nyilvános DNS-címeket használhat.');
    const address=addresses.find(value=>value.family===4)?.address||addresses[0].address;rules.push(`MAP ${host} ${address.includes(':')?'['+address+']':address}`);
  }
  return [...rules,'MAP * ~NOTFOUND'].join(', ');
}
export function checkRegioStatus(status:number,retryAfter:string|null=null){
  if(status===200)return;
  const retry=retryAfter?(/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now()):0;
  throw new ShopRequestError(`A REGIO HTTP ${status} választ adott.`,Number.isFinite(retry)?Math.max(0,Math.min(retry,24*60*60_000)):0,status===403?'protected':status===429?'rate_limited':'error');
}
export async function openRegioBrowser(signal:AbortSignal):Promise<RegioSession>{
  signal.throwIfAborted();const resolver=await regioResolverRules(lookup,AbortSignal.any([signal,AbortSignal.timeout(10_000)]));signal.throwIfAborted();let browser:Browser;
  try{const {chromium}=await import('playwright');browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:20000,args:['--no-proxy-server','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--host-resolver-rules='+resolver]});}
  catch{signal.throwIfAborted();throw new ShopRequestError('A REGIO Chromium nem indítható; a worker böngészőtelepítését ellenőrizni kell.');}
  const abort=()=>{void browser.close().catch(()=>{});},close=async()=>{signal.removeEventListener('abort',abort);await browser.close();};signal.addEventListener('abort',abort,{once:true});
  try{
    signal.throwIfAborted();const context=await browser.newContext({locale:'hu-HU',viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:false});let documents=0,searches=0;
    await context.route('**/*',route=>{const request=route.request();let allowed=regioResourceAllowed(request.url(),request.method(),request.resourceType());if(allowed&&request.resourceType()==='document')allowed=++documents===1;if(allowed&&new URL(request.url()).hostname==='api.prefixbox.com')allowed=++searches===1;return allowed?route.continue():route.abort('blockedbyclient');});
    await context.routeWebSocket('**/*',socket=>socket.close());const page=await context.newPage();context.on('page',popup=>{if(popup!==page)void popup.close().catch(()=>{});});
    return {close,read:()=>readRegioDocument(page,signal)};
  }catch(error){await close();throw error;}
}
export async function readRegioDocument(page:Page,signal:AbortSignal):Promise<RegioDocument>{
  signal.throwIfAborted();
  const result=page.waitForResponse(response=>{try{regioSearchRequestUrl(response.url());return response.request().method()==='GET';}catch{return false;}},{timeout:25000}).catch(()=>undefined);
  try{
    const response=await page.goto(REGIO_URL,{waitUntil:'domcontentloaded',timeout:25000});if(!response)throw new ShopRequestError('Nem érkezett REGIO-dokumentum.');checkRegioStatus(response.status(),response.headers()['retry-after']??null);regioFetchUrl(page.url());
    await checkRegioChallenge(page);
    const search=await result;if(!search){await checkRegioChallenge(page);throw new ShopRequestError('Nem érkezett igazolt REGIO keresési válasz.');}checkRegioStatus(search.status(),search.headers()['retry-after']??null);
    const text=await search.text();if(Buffer.byteLength(text)>3*1024*1024)throw new ShopRequestError('Túl nagy REGIO keresési válasz.');
    if(/^\s*</.test(text)&&challengeText.test(text))throw new ShopRequestError('A REGIO kereső hozzáférési ellenőrzést kér.',15*60_000,'protected');const api=JSON.parse(text);
    if(!Number.isSafeInteger(api.count)||api.count<1||api.count>30||!Array.isArray(api.documents)||api.documents.length!==api.count)throw new ShopRequestError('Nem igazolt teljes egyoldalas REGIO-lista; üres vagy lapozott keresés nem menthető.');
    await page.waitForFunction(count=>document.querySelectorAll('#prefixbox-app-container .prefixbox-product-container-wrapper').length===count,api.count,{timeout:10000});
    const wrappers=page.locator('#prefixbox-app-container .prefixbox-product-container-wrapper');
    for(let index=0;index<api.count;index++){signal.throwIfAborted();await wrappers.nth(index).scrollIntoViewIfNeeded({timeout:3000});await wrappers.nth(index).locator('.prefixbox-product-container').waitFor({state:'attached',timeout:3000});}
    const cartVisibility=await page.locator('#prefixbox-app-container [data-product-info]').evaluateAll(cards=>Object.fromEntries(cards.map(card=>{
      const id=JSON.parse(card.getAttribute('data-product-info')!).identifier,buttons=card.querySelectorAll('.add-to-cart'),button=buttons[0];let visible=buttons.length===1&&!!button&&button.getClientRects().length>0;
      for(let element:Element|null=button;visible&&element;element=element.parentElement){const style=getComputedStyle(element);if(style.display==='none'||['hidden','collapse'].includes(style.visibility)||style.opacity==='0'||element.hasAttribute('hidden')||element.hasAttribute('disabled')||element.getAttribute('aria-disabled')==='true'||element.getAttribute('aria-hidden')==='true')visible=false;}
      return [id,visible];
    })));
    const html=await page.content();if(Buffer.byteLength(html)>3*1024*1024)throw new ShopRequestError('Túl nagy REGIO-terméklista.');signal.throwIfAborted();return {url:page.url(),html,api,cartVisibility};
  }catch(error){signal.throwIfAborted();if(error instanceof ShopRequestError)throw error;throw new ShopRequestError('A REGIO böngészős lekérése nem adott igazolt teljes listát.');}
}
