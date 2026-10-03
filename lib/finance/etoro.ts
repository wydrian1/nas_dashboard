import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { boundedText } from './download.ts';
import type { EtoroValue } from './market-types.ts';

// Only this read-only URL is permitted. No orders, transfers, demo account or redirects.
export const ETORO_BALANCE_URL='https://public-api.etoro.com/api/v1/balances?displayCurrency=USD&includeZeroBalances=true&includeSubAccounts=true';
type Credentials={apiKey:string;userKey:string};
export class EtoroError extends Error {
  constructor(){super('Az eToro teljes egyenlege most nem érhető el. A mezőt kézzel töltsd ki; nem másoljuk az előző hónapot.');}
}
export function parseEtoroCredentials(text:string):Credentials {
  try{
    if(Buffer.byteLength(text)>16384)throw new EtoroError();
    const data=JSON.parse(text) as Record<string,unknown>;
    if(!data || Array.isArray(data) || Object.keys(data).length!==2 || typeof data.apiKey!=='string' || typeof data.userKey!=='string' || ![data.apiKey,data.userKey].every(value=>/^[A-Za-z0-9_+/=.-]{16,4096}$/.test(value)))throw new EtoroError();
    return {apiKey:data.apiKey,userKey:data.userKey};
  }catch{throw new EtoroError();}
}
export function parseEtoroBalance(data:unknown,now=Date.now()):EtoroValue {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new EtoroError();
  const row=data as Record<string,unknown>,total=row.totalBalance;
  if(row.displayCurrency!=='USD' || typeof total!=='number' || !Number.isFinite(total) || total<0 || total>1_000_000_000_000 || !Array.isArray(row.balances) || row.balances.length>1000)throw new EtoroError();
  // Do not reinterpret missing accounts, an unexpected currency or a partial response as zero.
  const ids=new Set<string>();let sum=0;
  for(const value of row.balances){
    if(!value || typeof value!=='object' || Array.isArray(value))throw new EtoroError();
    const account=value as Record<string,unknown>;
    if(typeof account.accountId!=='string' || !account.accountId || ids.has(account.accountId) || typeof account.accountType!=='string' || !account.accountType || account.displayCurrency!=='USD' || typeof account.displayBalance!=='number' || !Number.isFinite(account.displayBalance) || Math.abs(account.displayBalance)>1_000_000_000_000)throw new EtoroError();
    ids.add(account.accountId);sum+=account.displayBalance;
  }
  if(!row.balances.length || Math.abs(sum-total)>0.02+row.balances.length*0.005)throw new EtoroError();
  const usdMinor=Math.round(total*100);if(!Number.isSafeInteger(usdMinor))throw new EtoroError();
  // Only the aggregate leaves the server; credentials, account IDs and holdings are never returned.
  return {usdMinor,fetchedAt:new Date(now).toISOString()};
}
let cache:{expires:number;value:Promise<EtoroValue>}|null=null;
export async function loadEtoroValue(options?:{fetcher?:typeof fetch;credentials?:Credentials;now?:number}):Promise<EtoroValue> {
  const fetcher=options?.fetcher || fetch,now=options?.now ?? Date.now(),production=fetcher===fetch && !options?.credentials;
  if(production && (process.env.FINANCE_ETORO_ENABLED!=='true' || process.env.FINANCE_EXTERNAL_FETCH_ENABLED==='false'))throw new EtoroError();
  if(production && cache && cache.expires>now)return cache.value;
  const pending=(async()=>{
    try{
      const credentials=options?.credentials || parseEtoroCredentials(await readFile(resolve('.runtime/secrets/etoro.json'),'utf8'));
      const response=await fetcher(ETORO_BALANCE_URL,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store',headers:{Accept:'application/json','x-api-key':credentials.apiKey,'x-user-key':credentials.userKey,'x-request-id':randomUUID()}});
      return parseEtoroBalance(JSON.parse(await boundedText(response,1024*1024)),now);
    }catch{throw new EtoroError();} // Never propagate upstream errors/URLs/credentials to UI or logs.
  })();
  if(production){cache={expires:now+60_000,value:pending};pending.catch(()=>{if(cache?.value===pending)cache=null;});}
  return pending;
}
