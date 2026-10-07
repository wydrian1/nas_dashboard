import type { InflationSeries } from './inflation-types.ts';
import { nextMonth, validDate } from './types.ts';
import { usdToHuf, type FinanceMarket } from './market-types.ts';

export type CollectionCostItem={quantity:number;unit_price_minor:number;acquired_on:string|null};
export type CollectionGrowth={valueMinor:number|null;costMinor:number;adjustedCostMinor:number|null;nominalGainMinor:number|null;nominalRatio:number|null;realGainMinor:number|null;realRatio:number|null;quantity:number;unknownDates:number;futureItems:number;realUnavailable:string|null;inflationThrough:string|null;assumedAcquiredOn:string|null};
export type CollectionMarketGrowth={growth:CollectionGrowth|null;asOf:string|null;fetchedAt:string|null;rateDate:string|null;usdHuf:number|null;unavailable:string|null};

// Reuse the already retrieved market snapshot; no fetch, persistence or saved-value fallback.
export function collectionMarketGrowth(items:CollectionCostItem[],kind:'pokemon'|'lego',market?:FinanceMarket):CollectionMarketGrowth {
  const result:CollectionMarketGrowth={growth:null,asOf:null,fetchedAt:null,rateDate:null,usdHuf:null,unavailable:null};
  const provider=kind==='pokemon' ? 'Collectr' : 'BrickEconomy',source=kind==='pokemon' ? market?.collectr : market?.brickeconomy;
  if(!source)return {...result,unavailable:`Az aktuális ${provider}-érték nem érhető el; nem helyettesítjük mentett értékkel vagy bekerüléssel.`};
  try{
    if(!/^\d{4}-\d{2}-\d{2}T/.test(source.fetchedAt) || !Number.isFinite(Date.parse(source.fetchedAt)))throw new Error();
    validDate(source.fetchedAt.slice(0,10));result.fetchedAt=new Date(source.fetchedAt).toISOString();result.asOf=validDate(result.fetchedAt.slice(0,10));
    let value:number;
    if(kind==='pokemon'){
      if(!market?.rates)return {...result,unavailable:'A Collectr USD-értékének Ft-összehasonlításához nincs elérhető árfolyam; nem használunk mentett havi árfolyamot vagy értéket.'};
      value=usdToHuf(market.collectr!.usdMinor,market.rates.usdHuf);
      result.rateDate=validDate(market.rates.date);result.usdHuf=market.rates.usdHuf;
    }else value=market!.brickeconomy!.hufMinor;
    if(!Number.isSafeInteger(value) || value<0 || value>100_000_000_000_000)throw new Error();
    result.growth=collectionGrowth(items,value,result.asOf,market?.inflation??undefined);
    return result;
  }catch{return {...result,growth:null,unavailable:`Az aktuális ${provider}-érték vagy az átváltás nem érvényes; az összehasonlítás nem számolható.`};}
}

// Purchasing-month CPI is the price level at acquisition. Compound subsequent
// published monthly MoM indices only, never annual averages/YoY or invented gaps.
// An unpublished tail ends at the latest available month; internal gaps still fail.
function inflationFactor(from:string,to:string,inflation:InflationSeries|undefined):number|null {
  if(from===to)return 1;
  const indices=new Map<string,number|null>();
  for(const point of inflation?.monthly || []){
    if(indices.has(point.month))return null;
    indices.set(point.month,point.mom);
  }
  let factor=1;
  for(let month=nextMonth(from);month<=to;month=nextMonth(month)){
    const rate=indices.get(month);if(rate===null || rate===undefined || !Number.isFinite(rate) || rate<=-1 || rate>2)return null;
    factor*=1+rate;if(!Number.isFinite(factor))return null;
  }
  return factor;
}
export function collectionGrowth(items:CollectionCostItem[],valueMinor:number|null,asOf:string,inflation?:InflationSeries):CollectionGrowth {
  validDate(asOf);
  const eligible=items.filter(item=>!item.acquired_on || item.acquired_on<=asOf),unknownDates=eligible.filter(item=>!item.acquired_on).length;
  const asOfMonth=asOf.slice(0,7),inflationThrough=(inflation?.monthly || []).filter(point=>point.month<=asOfMonth && point.mom!==null).map(point=>point.month).sort().at(-1)??null;
  // A calculation-only anniversary, clamped for Feb 29; never persisted to inventory.
  const year=Number(asOf.slice(0,4))-1,month=Number(asOf.slice(5,7)),day=Math.min(Number(asOf.slice(8,10)),new Date(Date.UTC(year,month,0)).getUTCDate());
  const assumedAcquiredOn=unknownDates ? `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
  const costMinor=eligible.reduce((sum,item)=>sum+item.quantity*item.unit_price_minor,0),quantity=eligible.reduce((sum,item)=>sum+item.quantity,0);
  const nominalGainMinor=valueMinor===null || !eligible.length ? null : valueMinor-costMinor;
  let adjustedCostMinor:number|null=0,realUnavailable:string|null=null;
  if(!eligible.length){adjustedCostMinor=null;realUnavailable='Nincs bekerülési nyilvántartás ehhez az állapothoz.';}
  else for(const item of eligible){
    if(!item.unit_price_minor)continue;
    const purchaseMonth=(item.acquired_on??assumedAcquiredOn!).slice(0,7);
    const factor=purchaseMonth===asOfMonth ? 1 : inflationThrough===null ? null : purchaseMonth>=inflationThrough ? 1 : inflationFactor(purchaseMonth,inflationThrough,inflation);
    if(factor===null){adjustedCostMinor=null;realUnavailable='Hiányos KSH havi inflációs idősor: nem becsülünk hiányzó hónapot.';break;}
    const amount=Math.round(item.quantity*item.unit_price_minor*factor);
    if(!Number.isSafeInteger(amount) || !Number.isSafeInteger(adjustedCostMinor!+amount)){adjustedCostMinor=null;realUnavailable='Az inflációval korrigált bekerülési összeg túl nagy.';break;}
    adjustedCostMinor!+=amount;
  }
  const realGainMinor=valueMinor===null || adjustedCostMinor===null ? null : valueMinor-adjustedCostMinor;
  return {valueMinor,costMinor,adjustedCostMinor,nominalGainMinor,nominalRatio:nominalGainMinor===null || costMinor<=0 ? null : nominalGainMinor/costMinor,realGainMinor,realRatio:realGainMinor===null || !adjustedCostMinor || adjustedCostMinor<0 ? null : realGainMinor/adjustedCostMinor,quantity,unknownDates,futureItems:items.length-eligible.length,realUnavailable,inflationThrough,assumedAcquiredOn};
}
