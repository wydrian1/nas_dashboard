import type {CollectionCostItem} from './collection-growth-types.ts';
export function valuationQuality(items:CollectionCostItem[],fetchedAt:string|null,now=Date.now()){
  const missingDates=items.filter(item=>!item.acquired_on),zeroCosts=items.filter(item=>item.unit_price_minor===0),stamp=fetchedAt===null?NaN:Date.parse(fetchedAt);
  return {unknownDateRows:missingDates.length,unknownDateUnits:missingDates.reduce((sum,item)=>sum+item.quantity,0),unknownDateCostMinor:missingDates.reduce((sum,item)=>sum+item.unit_price_minor*item.quantity,0),zeroCostRows:zeroCosts.length,sourceState:!Number.isFinite(stamp)||stamp>now+60_000?'missing':now-stamp>86400000?'stale':'recent'} as const;
}
