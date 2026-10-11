import {open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {setTimeout as delay} from 'node:timers/promises';
import {load} from 'cheerio';
import {pinnedAddressOptions} from '../feed-download.ts';
import {isPublicAddress} from '../url-policy.ts';
import {BLOOMRIFT_URL} from './types.ts';
import {bloomriftFetchUrl,ShopRequestError} from './fetch-policy.ts';

export type BloomriftCredentials={username:string;password:string};
type Request={url:string;method:'GET'|'POST';cookie:string;body?:string};
type Response={status:number;body:string;cookies:string[];location?:string;retryAfterMs?:number};
export type BloomriftRequest=(input:Request,signal:AbortSignal)=>Promise<Response>;
const loginURL='https://bloomrift.eu/shop_logincheck.php';
const failure=()=>new ShopRequestError('A Bloomrift hitelesített munkamenete nem igazolható; a korábbi készlet megmarad.',0,'protected');
class BloomriftHTTPError extends ShopRequestError {
  constructor(status:number,retryAfterMs=0){super(status===429?'A Bloomrift HTTP 429 választ adott.':status===403?'A Bloomrift HTTP 403 választ adott.':'A Bloomrift hitelesített katalógusának lekérése sikertelen.',Number.isFinite(retryAfterMs)?Math.max(0,retryAfterMs):0,status===429?'rate_limited':status===403?'protected':'error');}
}

export function parseBloomriftCredentials(text:string):BloomriftCredentials {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  if(text.length>8192 || (lines[0]?.length || 0)>320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lines[0]||'') || !lines[1] || /[\x00-\x1f\x7f]/.test(lines[0]+lines[1]) || lines.slice(2).some(line=>line!==''))throw failure();
  return {username:lines[0],password:lines[1]};
}
export async function readBloomriftCredentials():Promise<BloomriftCredentials|null> {
  const explicit=process.env.BLOOMRIFT_CREDENTIALS_FILE;
  try{
    const file=await open(explicit || resolve('cert/bloom.key'),'r');
    try{const stat=await file.stat();if(!stat.isFile() || stat.size>8192)throw failure();return parseBloomriftCredentials(await file.readFile('utf8'));}finally{await file.close();}
  }
  catch(error){if(!explicit && (error as NodeJS.ErrnoException).code==='ENOENT')return null;throw failure();}
}
export function bloomriftSessionUrl(input:string,method:'GET'|'POST'):URL {
  if(method==='POST'){if(input!==loginURL)throw failure();return new URL(loginURL);}
  const url=bloomriftFetchUrl(input);if(url.pathname==='/robots.txt')throw failure();return url;
}
// Dedicated transport: never change the anonymous downloader's allowlist or forward a secret on redirects.
async function memberRequest(input:Request,signal:AbortSignal):Promise<Response> {
  const url=bloomriftSessionUrl(input.url,input.method),addresses=await lookup(url.hostname,{all:true});
  if(!addresses.length || addresses.some(address=>!isPublicAddress(address.address)))throw failure();
  return new Promise((accept,reject)=>{
    const headers:Record<string,string>={'User-Agent':'WydrianMonitor/1.0 (personal stock monitor)',Accept:'text/html','Accept-Encoding':'identity'};
    if(input.cookie)headers.Cookie=input.cookie;
    if(input.method==='POST'){headers['Content-Type']='application/x-www-form-urlencoded';headers['Content-Length']=String(Buffer.byteLength(input.body || ''));headers.Origin=url.origin;headers.Referer=BLOOMRIFT_URL;}
    const req=request(url,{...pinnedAddressOptions(addresses[0]),method:input.method,headers,signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])},res=>{
      const chunks:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>3*1024*1024)req.destroy(failure());else chunks.push(chunk);});
      res.on('end',()=>{const retry=res.headers['retry-after'],retryAfterMs=typeof retry==='string'?(/^\d+$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())):0;accept({status:res.statusCode || 0,body:Buffer.concat(chunks).toString('utf8'),cookies:res.headers['set-cookie'] || [],location:res.headers.location,retryAfterMs});});
      res.on('error',()=>reject(failure()));res.on('aborted',()=>reject(failure()));
    });req.on('error',()=>reject(failure()));req.end(input.body);
  });
}
export function bloomriftMemberPage(html:string):boolean {
  const $=load(html);
  return $('a[href="https://bloomrift.eu/shop_logout.php"],a[href="/shop_logout.php"]').length===1 && !$('input[name="shop_pass_login"]').length && !$('.not-buyable__text').toArray().some(element=>$(element).text().includes('regisztrált és bejelentkezett'));
}
export function createBloomriftMemberDownload(credentials:BloomriftCredentials,options:{request?:BloomriftRequest;wait?:(ms:number,signal:AbortSignal)=>Promise<unknown>;delayMs?:number}={}) {
  const send=options.request || memberRequest,wait=options.wait || ((ms:number,signal:AbortSignal)=>delay(ms,undefined,{signal}));
  const delayMs=Math.max(1500,options.delayMs || 0);
  // Cookies are host-only and process-memory-only; only the fixed category and login endpoint can receive them.
  const cookies=new Map<string,{value:string;path:string}>();let authenticated=false;
  function remember(values:string[]){
    for(const value of values){
      if(value.length>8192 || /[\r\n]/.test(value))throw failure();
      const [pair,...attrs]=value.split(';'),equal=pair.indexOf('='),name=pair.slice(0,equal),content=pair.slice(equal+1);
      if(equal<1 || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name) || /[\x00-\x20\x7f;,]/.test(content))throw failure();
      const attributes=new Map(attrs.map(attr=>{const [key,...rest]=attr.trim().split('=');return [key.toLowerCase(),rest.join('=')];}));
      if(attributes.has('domain') && !/^\.?bloomrift\.eu$/i.test(attributes.get('domain')!))throw failure();
      const path=attributes.get('path') || '/';if(!path.startsWith('/') || /[\x00-\x20\x7f;]/.test(path))throw failure();
      if(attributes.get('max-age')==='0' || attributes.has('expires') && Date.parse(attributes.get('expires')!)<=Date.now())cookies.delete(name);
      else cookies.set(name,{value:content,path});
    }
    if(cookies.size>40)throw failure();
  }
  async function call(url:string,method:'GET'|'POST',signal:AbortSignal,body?:string){
    const target=bloomriftSessionUrl(url,method);signal.throwIfAborted();
    await wait(delayMs,signal);
    const cookie=[...cookies].filter(([,entry])=>target.pathname===entry.path || target.pathname.startsWith(entry.path.endsWith('/')?entry.path:entry.path+'/')).map(([name,entry])=>name+'='+entry.value).join('; ');
    if(cookie.length>32768)throw failure();
    const result=await send({url:target.href,method,cookie,body},signal);
    if(result.status===403 || result.status===429 || result.status>=500)throw new BloomriftHTTPError(result.status,result.retryAfterMs);
    remember(result.cookies);return result;
  }
  return async(input:string,signal:AbortSignal):Promise<string>=>{
    try{
      bloomriftSessionUrl(input,'GET');
      if(!authenticated){
        const publicPage=await call(BLOOMRIFT_URL,'GET',signal);if(publicPage.status!==200)throw failure();
        const $=load(publicPage.body),form=$('form[action="https://bloomrift.eu/shop_logincheck.php"]');
        if(form.length!==1 || form.attr('method')?.toLowerCase()!=='post' || form.find('input[name="shop_user_login"][type="email"]').length!==1 || form.find('input[name="shop_pass_login"][type="password"]').length!==1 || form.find('input[type="hidden"]').length!==2 || form.find('input[name="file_back"]').attr('value')!=='/Osszes-angol-termek' || form.find('input[name="login_redir"]').attr('value')!=='')throw failure();
        const body=new URLSearchParams({file_back:'/Osszes-angol-termek',login_redir:'',shop_user_login:credentials.username,shop_pass_login:credentials.password}).toString();
        const login=await call(loginURL,'POST',signal,body);
        const target=login.location?new URL(login.location,loginURL).href:'';
        if(![302,303].includes(login.status) || ![BLOOMRIFT_URL,BLOOMRIFT_URL+'?get=login_ok'].includes(target))throw failure();
      }
      const page=await call(input,'GET',signal);
      if(page.status!==200 || !bloomriftMemberPage(page.body))throw failure();
      authenticated=true;return page.body;
    }catch(error){authenticated=false;cookies.clear();if(error instanceof BloomriftHTTPError)throw error;throw failure();} // No upstream bodies, paths, cookies or credentials in logs/UI.
  };
}
let cached:{credentials:BloomriftCredentials;download:ReturnType<typeof createBloomriftMemberDownload>;expires:number;delayMs:number}|undefined;
export function bloomriftMemberDownload(credentials:BloomriftCredentials,delayMs:number){
  if(!cached || cached.expires<=Date.now() || cached.delayMs!==delayMs || cached.credentials.username!==credentials.username || cached.credentials.password!==credentials.password)cached={credentials,download:createBloomriftMemberDownload(credentials,{delayMs}),expires:Date.now()+30*60_000,delayMs};
  return cached.download;
}
