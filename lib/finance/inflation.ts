import { load } from 'cheerio';
import { FinanceInputError, validMonth } from './types.ts';
import { KSH_ANNUAL_URL, KSH_MONTHLY_URL } from './inflation-types.ts';
import type { InflationSeries } from './inflation-types.ts';
import { boundedText } from './download.ts';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const monthNames=['januar','februar','marcius','aprilis','majus','junius','julius','augusztus','szeptember','oktober','november','december'];
function cpi(value:string):number|null {
  const text=value.trim();if(!text || text==='..')return null;
  if(!/^\d{2,3},\d$/.test(text))throw new FinanceInputError('A KSH árindex formátuma megváltozott.');
  const index=Number(text.replace(',','.'));if(index<50 || index>300)throw new FinanceInputError('Érvénytelen KSH árindex.');
  return (index-100)/100;
}
export function parseKshInflation(annualHtml:string,monthlyHtml:string,now=Date.now()):InflationSeries {
  const annualDoc=load(annualHtml),monthlyDoc=load(monthlyHtml),annual:InflationSeries['annual']=[],monthly:InflationSeries['monthly']=[];
  const headerIndex=(doc:ReturnType<typeof load>)=>{
    const headers=doc('table.stadat thead th').map((_,el)=>normalize(doc(el).text())).get();
    const index=headers.indexOf('osszesen');if(index!==8)throw new FinanceInputError('A KSH összesített árindex oszlopa nem azonosítható.');return index-1;
  };
  const annualIndex=headerIndex(annualDoc),monthlyIndex=headerIndex(monthlyDoc),currentYear=new Date(now).getUTCFullYear(),currentMonth=new Date(now).toISOString().slice(0,7);
  annualDoc('table.stadat tbody tr').each((_,row)=>{
    const year=annualDoc(row).children('th').first().text().trim();if(!/^\d{4}$/.test(year) || Number(year)>=currentYear)return;
    const value=cpi(annualDoc(row).children('td').eq(annualIndex).text());if(value!==null && Number(year)<currentYear)annual.push({year:Number(year),rate:value});
  });
  const byMonth=new Map<string,{yoy?:number;mom?:number}>();let foundYoy=false,foundMom=false;
  monthlyDoc('table.stadat tbody').each((_,body)=>{
    const title=normalize(monthlyDoc(body).find('tr.franciacim').first().text());
    const kind=title.startsWith('az elozo ev azonos idoszaka =') ? 'yoy' : title.startsWith('elozo honap =') ? 'mom' : null;
    if(!kind)return;if(kind==='yoy'){if(foundYoy)throw new FinanceInputError('Ismétlődő KSH éves szekció.');foundYoy=true;}else{if(foundMom)throw new FinanceInputError('Ismétlődő KSH havi szekció.');foundMom=true;}
    let year='';
    monthlyDoc(body).children('tr').not('.franciacim').each((_,row)=>{
      const headings=monthlyDoc(row).children('th'),rawYear=headings.eq(0).text().trim().replace(/\.$/,'');
      if(rawYear){if(!/^\d{4}$/.test(rawYear))return;year=rawYear;}
      const monthIndex=monthNames.indexOf(normalize(headings.eq(1).text()));if(!year || monthIndex<0)return;
      const month=validMonth(`${year}-${String(monthIndex+1).padStart(2,'0')}`),value=cpi(monthlyDoc(row).children('td').eq(monthlyIndex).text());
      if(value===null || month>=currentMonth)return;
      const entry=byMonth.get(month) || {};if(entry[kind]!==undefined)throw new FinanceInputError('Ismétlődő KSH hónap.');entry[kind]=value;byMonth.set(month,entry);
    });
  });
  for(const [month,values] of [...byMonth].sort(([a],[b])=>a.localeCompare(b)))if(values.yoy!==undefined)monthly.push({month,yoy:values.yoy,mom:values.mom ?? null});
  if(!foundYoy || !foundMom || !annual.length || !monthly.length)throw new FinanceInputError('Hiányos KSH inflációs idősor.');
  return {annual,monthly,fetchedAt:new Date(now).toISOString()};
}
let cache:{expires:number;value:Promise<InflationSeries>}|null=null;
export async function loadInflation(fetcher:typeof fetch=fetch,now=Date.now()):Promise<InflationSeries> {
  if(process.env.FINANCE_EXTERNAL_FETCH_ENABLED==='false' && fetcher===fetch)throw new Error('External finance requests disabled');
  if(fetcher===fetch && cache && cache.expires>now)return cache.value;
  const pending=(async()=>{
    const download=async(url:string)=>boundedText(await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store',headers:{Accept:'text/html'}}),2*1024*1024,'iso-8859-2');
    const [annual,monthly]=await Promise.all([download(KSH_ANNUAL_URL),download(KSH_MONTHLY_URL)]);return parseKshInflation(annual,monthly,now);
  })();
  if(fetcher===fetch){cache={expires:now+6*60*60_000,value:pending};pending.catch(()=>{if(cache?.value===pending)cache=null;});}
  return pending;
}
