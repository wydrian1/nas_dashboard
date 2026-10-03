import { load } from 'cheerio';
import { FinanceInputError, parseMoney, validDate } from './types.ts';
import { COLLECTR_PROFILE, validRateDate } from './market-types.ts';
import type { CollectrValue, ExchangeRates, FinanceMarket } from './market-types.ts';
import { loadInflation } from './inflation.ts';
import { boundedText } from './download.ts';
import { loadEtoroValue,EtoroError } from './etoro.ts';

type Fetcher=typeof fetch;
export function parseCollectrValue(html:string):number {
  const $=load(html);$('script,style,template').remove();
  const units=$('button').map((_,element)=>$(element).text().trim()).get().filter(value=>/^[A-Z]{3}$/.test(value));
  if(units.length && !units.includes('USD'))throw new FinanceInputError('A Collectr oldal devizája nem USD.');
  const candidates:number[]=[];
  $('h1,h2,h3,h4,p,span,div').filter((_,element)=>$(element).children().length===0 && $(element).text().trim()==='Estimated Portfolio Value').each((_,element)=>{
    const value=$(element).next().text().trim();
    // Explicit dollar symbol and strict US grouping; never parse a product price or a skeleton as zero.
    if(!/^\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?$/.test(value))return;
    const amount=parseMoney(value.slice(1).replaceAll(',',''));if(amount!==null)candidates.push(amount);
  });
  const values=[...new Set(candidates)];
  if(values.length!==1)throw new FinanceInputError('A Collectr becsült USD-portfólióértéke most nem olvasható ki egyértelműen.');
  return values[0];
}
export function parseRate(data:unknown,base:'USD'|'EUR',requestedDate?:string,now=Date.now()):{date:string;rate:number} {
  const row=data as {date?:unknown;base?:unknown;quote?:unknown;rate?:unknown};
  if(!row || row.base!==base || row.quote!=='HUF' || typeof row.rate!=='number' || !Number.isFinite(row.rate) || row.rate<1 || row.rate>10000)throw new FinanceInputError('Érvénytelen árfolyam-válasz.');
  const date=validDate(row.date);
  if(requestedDate && date!==requestedDate)throw new FinanceInputError('A kért árfolyamnaphoz nincs azonos napi adat. Frissítsd az oldalt.');
  validRateDate(date,now);return {date,rate:row.rate};
}
let rateCache:{expires:number;value:Promise<ExchangeRates>}|null=null;
let collectrCache:{expires:number;value:Promise<CollectrValue>}|null=null;

export async function loadExchangeRates(date?:string,fetcher:Fetcher=fetch,now=Date.now()):Promise<ExchangeRates> {
  if(process.env.FINANCE_EXTERNAL_FETCH_ENABLED==='false' && fetcher===fetch)throw new Error('External finance requests disabled');
  if(date)validRateDate(date,now);
  if(!date && fetcher===fetch && rateCache && rateCache.expires>now)return rateCache.value;
  const pending=(async()=>{
    const request=async(base:'USD'|'EUR')=>{
      const url=`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/huf?providers=ecb${date ? '&date='+date : ''}`;
      const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store',headers:{Accept:'application/json'}});
      return parseRate(JSON.parse(await boundedText(response,16000)),base,date,now);
    };
    const [usd,eur]=await Promise.all([request('USD'),request('EUR')]);
    if(usd.date!==eur.date)throw new FinanceInputError('A két deviza árfolyamnapja eltér.');
    return {date:usd.date,usdHuf:usd.rate,eurHuf:eur.rate,fetchedAt:new Date(now).toISOString()};
  })();
  if(!date && fetcher===fetch){rateCache={expires:now+15*60_000,value:pending};pending.catch(()=>{if(rateCache?.value===pending)rateCache=null;});}
  return pending;
}
export async function loadCollectrValue(fetcher:Fetcher=fetch,now=Date.now()):Promise<CollectrValue> {
  if(process.env.FINANCE_EXTERNAL_FETCH_ENABLED==='false' && fetcher===fetch)throw new Error('External finance requests disabled');
  if(fetcher===fetch && collectrCache && collectrCache.expires>now)return collectrCache.value;
  const pending=(async()=>{
    const response=await fetcher(COLLECTR_PROFILE,{redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store',headers:{Accept:'text/html','User-Agent':'WydrianDashboard/0.1'}});
    return {usdMinor:parseCollectrValue(await boundedText(response,2*1024*1024)),fetchedAt:new Date(now).toISOString()};
  })();
  if(fetcher===fetch){collectrCache={expires:now+5*60_000,value:pending};pending.catch(()=>{if(collectrCache?.value===pending)collectrCache=null;});}
  return pending;
}
export async function financeMarket():Promise<FinanceMarket> {
  const enabled=process.env.FINANCE_ETORO_ENABLED==='true';
  const [rates,collectr,inflation,etoro]=await Promise.allSettled([loadExchangeRates(),loadCollectrValue(),loadInflation(),enabled ? loadEtoroValue() : Promise.resolve(null)]);
  return {rates:rates.status==='fulfilled' ? rates.value : null,collectr:collectr.status==='fulfilled' ? collectr.value : null,
    rateError:rates.status==='rejected' ? 'Az árfolyam most nem érhető el. USD-ben menteni ellenőrzött árfolyam nélkül nem lehet; Ft-bevitel használható.' : null,
    collectrError:collectr.status==='rejected' ? 'A Collectr értéke most nem érhető el. A Pokémon-mezőt kézzel töltsd ki; nem másoljuk az előző hónapot.' : null,
    etoro:etoro.status==='fulfilled' ? etoro.value : null,
    etoroError:etoro.status==='rejected' ? new EtoroError().message : null,
    inflation:inflation.status==='fulfilled' ? inflation.value : null,
    inflationError:inflation.status==='rejected' ? 'A KSH idősora most nem érhető el. Csak a korábban importált éves inflációval számolunk; új hónapra nem becsülünk adatot.' : null};
}
