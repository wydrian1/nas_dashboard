import {load} from 'cheerio';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {FinanceInputError,parseMoney} from './types.ts';
import {BRICKECONOMY_PROFILE} from './market-types.ts';
import type {BrickEconomyValue} from './market-types.ts';
import {boundedText} from './download.ts';

const profileUrl=BRICKECONOMY_PROFILE+'?currency=HUF',maxBytes=2*1024*1024,run=promisify(execFile);
export function parseBrickEconomyValue(html:string):number {
  const $=load(html);$('script,style,template').remove();
  if($('h1').text().trim()!=="wydrian's LEGO Collection")throw new FinanceInputError('A BrickEconomy publikus LEGO-profilja nem olvasható.');
  // Read only the Owned Sets summary, never product prices, wanted sets or loose minifigures.
  const sections=$('.side-box-body > .semibold').filter((_,element)=>$(element).text().trim()==='Owned Sets');
  if(sections.length!==1)throw new FinanceInputError('A BrickEconomy készletösszesítője nem egyértelmű.');
  const rows=sections.nextUntil('.semibold').filter('.rowlist').filter((_,element)=>$(element).children().first().text().trim()==='Current value');
  if(rows.length!==1 || rows.children().length!==2)throw new FinanceInputError('A BrickEconomy Current value értéke nem egyértelmű.');
  const text=rows.children().last().text().trim();
  if(!/^(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2})? Ft$/.test(text))throw new FinanceInputError('A BrickEconomy értéke nem ellenőrzött HUF-összeg.');
  const amount=parseMoney(text.slice(0,-3).replace(/[ \u00a0\u202f]/g,'').replace(',','.'));
  if(amount===null || amount<0)throw new FinanceInputError('Hiányzó BrickEconomy érték.');
  return amount;
}
export function brickEconomyCurlArgs():string[] {
  // Windows' native TLS client can read this public page where Node's TLS client is challenged.
  // No curlrc, cookie jar, credentials, redirects, JavaScript, arbitrary URL or TLS exceptions.
  return ['--disable','--silent','--show-error','--fail','--globoff','--proto','=https','--max-time','12','--max-filesize',String(maxBytes),'--request','GET','--header','Accept: text/html','--user-agent','WydrianDashboard/1.4','--write-out','\nWYDRIAN_RESPONSE:%{http_code}:%{content_type}','--url',profileUrl];
}
async function windowsProfile():Promise<string> {
  const {stdout}=await run(join(process.env.SystemRoot||'C:\\Windows','System32','curl.exe'),brickEconomyCurlArgs(),{encoding:'utf8',maxBuffer:maxBytes+1024,timeout:14000,windowsHide:true});
  return brickEconomyCurlBody(stdout);
}
export function brickEconomyCurlBody(stdout:string):string {
  const marker=stdout.lastIndexOf('\nWYDRIAN_RESPONSE:'),body=stdout.slice(0,marker),status=stdout.slice(marker);
  if(marker<0 || !/^\nWYDRIAN_RESPONSE:200:text\/html(?:;[^\r\n]*)?$/.test(status) || Buffer.byteLength(body)>maxBytes)throw new Error('Public BrickEconomy download failed');
  return body;
}
let cache:{expires:number;value:Promise<BrickEconomyValue>}|null=null;
export async function loadBrickEconomyValue(fetcher:typeof fetch=fetch,now=Date.now()):Promise<BrickEconomyValue> {
  if(fetcher===fetch && process.env.FINANCE_EXTERNAL_FETCH_ENABLED==='false')throw new Error('External finance requests disabled');
  if(fetcher===fetch && cache && cache.expires>now)return cache.value;
  const pending=(async()=>{
    const html=fetcher===fetch && process.platform==='win32' ? await windowsProfile() : await (async()=>{
      const response=await fetcher(profileUrl,{redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store',headers:{Accept:'text/html','User-Agent':'WydrianDashboard/1.4'}});
      if(!response.headers.get('content-type')?.toLowerCase().startsWith('text/html'))throw new Error('Invalid BrickEconomy response type');
      return boundedText(response,maxBytes);
    })();
    return {hufMinor:parseBrickEconomyValue(html),fetchedAt:new Date(now).toISOString()};
  })();
  if(fetcher===fetch){cache={expires:now+5*60_000,value:pending};pending.catch(()=>{if(cache?.value===pending)cache=null;});}
  return pending;
}
