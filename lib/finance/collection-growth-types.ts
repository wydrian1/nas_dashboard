import type { InflationSeries } from './inflation-types.ts';
import { nextMonth, validDate } from './types.ts';

export type CollectionCostItem={quantity:number;unit_price_minor:number;acquired_on:string|null};
export type CollectionGrowth={valueMinor:number|null;costMinor:number;adjustedCostMinor:number|null;nominalGainMinor:number|null;nominalRatio:number|null;realGainMinor:number|null;realRatio:number|null;quantity:number;unknownDates:number;futureItems:number;realUnavailable:string|null};

// Purchasing-month CPI is the price level at acquisition. Compound subsequent
// published monthly MoM indices only, never annual averages/YoY or invented gaps.
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
  const costMinor=eligible.reduce((sum,item)=>sum+item.quantity*item.unit_price_minor,0),quantity=eligible.reduce((sum,item)=>sum+item.quantity,0);
  const nominalGainMinor=valueMinor===null || !eligible.length ? null : valueMinor-costMinor;
  let adjustedCostMinor:number|null=0,realUnavailable:string|null=null;
  if(!eligible.length){adjustedCostMinor=null;realUnavailable='Nincs bekerülési nyilvántartás ehhez az állapothoz.';}
  else if(eligible.some(item=>!item.acquired_on && item.unit_price_minor>0)){adjustedCostMinor=null;realUnavailable='Hiányzó vásárlási dátum miatt a teljes reálgyarapodás nem számolható.';}
  else for(const item of eligible){
    if(!item.unit_price_minor)continue;
    const factor=inflationFactor(item.acquired_on!.slice(0,7),asOf.slice(0,7),inflation);
    if(factor===null){adjustedCostMinor=null;realUnavailable='Hiányos KSH havi inflációs idősor: nem becsülünk hiányzó hónapot.';break;}
    const amount=Math.round(item.quantity*item.unit_price_minor*factor);
    if(!Number.isSafeInteger(amount) || !Number.isSafeInteger(adjustedCostMinor!+amount)){adjustedCostMinor=null;realUnavailable='Az inflációval korrigált bekerülési összeg túl nagy.';break;}
    adjustedCostMinor!+=amount;
  }
  const realGainMinor=valueMinor===null || adjustedCostMinor===null ? null : valueMinor-adjustedCostMinor;
  return {valueMinor,costMinor,adjustedCostMinor,nominalGainMinor,nominalRatio:nominalGainMinor===null || costMinor<=0 ? null : nominalGainMinor/costMinor,realGainMinor,realRatio:realGainMinor===null || !adjustedCostMinor || adjustedCostMinor<0 ? null : realGainMinor/adjustedCostMinor,quantity,unknownDates,futureItems:items.length-eligible.length,realUnavailable};
}
