import {lookup} from 'node:dns/promises';
import type {LookupAddress} from 'node:dns';
import {isPublicAddress} from '../url-policy.ts';
import {alzaFetchUrl,ShopRequestError} from './fetch-policy.ts';
import type {Page,Browser} from 'playwright';

// Fixed assets only; no third-party trackers, APIs, product pages, account or cart requests.
export const ALZA_ASSET_HOSTS=['cdn.alza.cz','cdn.alza.hu','image.alza.cz','1161575864.rsc.cdn77.org','1452430460.rsc.cdn77.org'] as const;
export type AlzaDocument={url:string;html:string;cartVisibility:Record<string,boolean>};
export type AlzaSession={read:(url:string)=>Promise<AlzaDocument>;close:()=>Promise<void>};
// Normal Chromium also runs in Windows' service session; no user's desktop/profile is used.
export function alzaBrowserHeadless(mode=process.env.ALZA_BROWSER_MODE||(process.platform==='win32'?'headed':'headless')):boolean {
  if(!['headless','headed'].includes(mode))throw new ShopRequestError('Érvénytelen ALZA_BROWSER_MODE; headless vagy headed adható meg.');
  return mode==='headless';
}
export function alzaResourceAllowed(input:string,method:string,type:string):boolean {
  try{
    const url=new URL(input);
    if(url.protocol!=='https:' || url.username || url.password || url.port || url.hash || !['GET','HEAD'].includes(method))return false;
    if(type==='document'){alzaFetchUrl(input);return method==='GET';}
    if(!['script','stylesheet','image','font'].includes(type))return false;
    return (ALZA_ASSET_HOSTS as readonly string[]).includes(url.hostname) || url.hostname==='m.alza.hu'&&/^\/(?:js|javascript|css|styles|content|scripts|foto|assets|fonts|images)\//i.test(url.pathname);
  }catch{return false;}
}
export async function alzaResolverRules(resolve:typeof lookup=lookup,signal=AbortSignal.timeout(10_000)):Promise<string> {
  const rules:string[]=[];
  for(const host of ['m.alza.hu',...ALZA_ASSET_HOSTS]){
    signal.throwIfAborted();
    const addresses=await new Promise<LookupAddress[]>((done,reject)=>{
      const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
      resolve(host,{all:true}).then(done,reject).finally(()=>signal.removeEventListener('abort',abort));
    });
    if(!addresses.length || addresses.some(value=>!isPublicAddress(value.address)))throw new ShopRequestError('Az Alza böngésző csak nyilvános hálózati címeket használhat.');
    const address=addresses.find(value=>value.family===4)?.address||addresses[0].address;
    rules.push(`MAP ${host} ${address.includes(':')?'['+address+']':address}`);
  }
  // Pin checked DNS answers for the entire process; block all unreviewed hosts as well.
  return [...rules,'MAP * ~NOTFOUND'].join(', ');
}
export function checkAlzaStatus(status:number,retryAfter:string|null=null) {
  if(status===200)return;
  const retry=retryAfter?(/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now()):0;
  throw new ShopRequestError(`Az Alza HTTP ${status} választ adott.`,Number.isFinite(retry)?Math.max(0,Math.min(retry,24*60*60_000)):0,status===403?'protected':status===429?'rate_limited':'error');
}
export async function openAlzaBrowser(signal:AbortSignal):Promise<AlzaSession> {
  signal.throwIfAborted();
  const headless=alzaBrowserHeadless();
  const resolver=await alzaResolverRules(lookup,AbortSignal.any([signal,AbortSignal.timeout(10_000)]));signal.throwIfAborted();
  let browser:Browser;
  try{const {chromium}=await import('playwright');browser=await chromium.launch({headless,chromiumSandbox:true,timeout:20_000,args:['--no-proxy-server','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--host-resolver-rules='+resolver]});}
  catch{signal.throwIfAborted();throw new ShopRequestError('Az Alza Chromium nem indítható; a worker böngészőtelepítését ellenőrizni kell.');}
  const close=async()=>{signal.removeEventListener('abort',abort);await browser.close();};
  const abort=()=>{void browser.close().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try{
    signal.throwIfAborted();
    const context=await browser.newContext({locale:'hu-HU',viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:false});
    await context.route('**/*',route=>alzaResourceAllowed(route.request().url(),route.request().method(),route.request().resourceType())?route.continue():route.abort('blockedbyclient'));
    await context.routeWebSocket('**/*',socket=>socket.close());
    const page=await context.newPage();
    context.on('page',popup=>{if(popup!==page)void popup.close().catch(()=>{});});
    return {close,read:input=>readAlzaDocument(page,input,signal)};
  }catch(error){await close();throw error;}
}
// Separately testable against a fully routed synthetic browser page, never a live shop.
export async function readAlzaDocument(page:Page,input:string,signal:AbortSignal):Promise<AlzaDocument> {
  signal.throwIfAborted();const url=alzaFetchUrl(input);
  try{
    const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:25_000});
    if(!response)throw new ShopRequestError('Nem érkezett Alza-dokumentum.');
    checkAlzaStatus(response.status(),response.headers()['retry-after']??null);
    if(alzaFetchUrl(page.url()).href!==url.href)throw new ShopRequestError('Az Alza elvesztette a kért készletszűrőt.',0,'protected');
    if(Number(response.headers()['content-length']||0)>3*1024*1024)throw new ShopRequestError('Túl nagy Alza-dokumentum.');
    // Mobile SSR uses #itemsContainer, NOT the desktop #boxes/radio controls.
    await page.waitForFunction(()=>{
      const text=(document.title+' '+(document.body?.innerText||'').slice(0,12000)).toLowerCase();
      return /captcha|access denied|just a moment|verify you are human|checking your browser|biztonsági ellenőrzés|hozzáférés megtagadva/.test(text) || !!document.querySelector('#itemsContainer .js-box.item[data-id]');
    },undefined,{timeout:15_000});
    const cartVisibility=await page.evaluate(()=>Object.fromEntries(Array.from(document.querySelectorAll('#itemsContainer .js-box.item[data-id]')).map(card=>{
      const buttons=card.querySelectorAll<HTMLButtonElement>('button.js-buy'),button=buttons[0];
      let visible=buttons.length===1 && !!button && !button.disabled && button.getClientRects().length>0;
      for(let element:Element|null=button;visible&&element;element=element.parentElement){const style=getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0'||element.hasAttribute('hidden')||element.getAttribute('aria-disabled')==='true')visible=false;}
      return [card.getAttribute('data-id')!,visible];
    })));
    const html=await page.content();if(Buffer.byteLength(html)>3*1024*1024)throw new ShopRequestError('Túl nagy Alza-terméklista.');
    return {url:page.url(),html,cartVisibility};
  }catch(error){
    signal.throwIfAborted();
    if(error instanceof ShopRequestError)throw error;
    // Never propagate browser diagnostics containing session URLs, tokens or page data.
    throw new ShopRequestError('Az Alza böngészős lekérése nem adott igazolt teljes dokumentumot.');
  }
}
