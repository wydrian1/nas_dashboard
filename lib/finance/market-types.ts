import { FinanceInputError, validDate } from './types.ts';
import type { FinanceAccount, FinanceSnapshot } from './types.ts';
import type { InflationSeries } from './inflation-types.ts';
import { parseIntegerMoney, integerMoneyInput } from './input-types.ts';

export const USD_ACCOUNT_IDS=['cashflow-row-17','cashflow-row-35','cashflow-row-45'] as const;
export const COLLECTR_ACCOUNT_ID='cashflow-row-45';
export const ETORO_ACCOUNT_ID='cashflow-row-35';
export const COLLECTR_PROFILE='https://app.getcollectr.com/showcase/profile/@wydrian';
export type ExchangeRates={date:string;usdHuf:number;eurHuf:number;fetchedAt:string};
export type CollectrValue={usdMinor:number;fetchedAt:string};
export type EtoroValue={usdMinor:number;fetchedAt:string};
export type FinanceMarket={rates:ExchangeRates|null;collectr:CollectrValue|null;rateError:string|null;collectrError:string|null;inflation:InflationSeries|null;inflationError:string|null;etoro?:EtoroValue|null;etoroError?:string|null};
export function usdAccount(id:string):boolean{return (USD_ACCOUNT_IDS as readonly string[]).includes(id);}
export function usdToHuf(usdMinor:number,rate:number):number {
  if(!Number.isSafeInteger(usdMinor) || usdMinor<0 || !Number.isFinite(rate) || rate<=0 || rate>10000)throw new FinanceInputError('Érvénytelen USD-összeg vagy árfolyam.');
  const hufMinor=Math.round(usdMinor*rate);
  if(!Number.isSafeInteger(hufMinor) || hufMinor>100_000_000_000_000)throw new FinanceInputError('Az átváltott összeg túl nagy.');
  return hufMinor;
}
export function formNeedsUsd(data:FormData,accounts:FinanceAccount[]):boolean {
  return accounts.some(account=>data.get('currency:'+account.id)==='USD' && data.get('amount:'+account.id)!=='');
}
// Return a fresh, Ft-only form. Original USD input never reaches the balance/audit store.
export function hufFinanceForm(data:FormData,accounts:FinanceAccount[],rates:ExchangeRates|null):FormData {
  const normalized=new FormData();for(const [key,value] of data)if(!key.startsWith('currency:') && key!=='fx_date')normalized.append(key,value);
  const known=new Set(accounts.map(account=>'currency:'+account.id));
  for(const key of data.keys())if(key.startsWith('currency:') && !known.has(key))throw new FinanceInputError('Ismeretlen devizamező.');
  for(const account of accounts){
    const currencies=data.getAll('currency:'+account.id),currency=currencies.length ? currencies[0] : 'HUF';
    if(currencies.length>1 || !['HUF','USD'].includes(String(currency)) || (currency==='USD' && !usdAccount(account.id)))throw new FinanceInputError('Érvénytelen beviteli deviza.');
    if(data.getAll('amount:'+account.id).length!==1)throw new FinanceInputError('Hiányos vagy ismétlődő összegmező.');
    const amount=parseIntegerMoney(data.get('amount:'+account.id));
    normalized.set('amount:'+account.id,integerMoneyInput(amount));
    if(currency==='USD'){
      if(amount===null)throw new FinanceInputError(`${account.name}: adj meg USD-összeget, lezárt tételnél 0-t. Nem másoljuk az előző havi Ft-értéket.`);
      if(!rates)throw new FinanceInputError('USD-mentéshez ellenőrzött árfolyam szükséges. Frissítsd az árfolyamot, vagy válassz Ft-bevitelt.');
      normalized.set('amount:'+account.id,(usdToHuf(amount,rates.usdHuf)/100).toFixed(2));
    }
  }
  return normalized;
}
export function validRateDate(date:unknown,now=Date.now()):string {
  const value=validDate(date),age=now-Date.parse(value+'T00:00:00Z');
  if(age<0 || age>8*86400000)throw new FinanceInputError('Az árfolyam dátuma elavult vagy jövőbeli. Frissítsd az oldalt a mentés előtt.');
  return value;
}
export type RealGrowthPeriod={label:string;startDate:string;endDate:string;nominal:number;inflation:number;real:number;realGain:number;endReal:number};
export function realGrowthPeriods(snapshot:FinanceSnapshot):RealGrowthPeriod[] {
  const cutoff=snapshot.selected?.as_of || '';
  return snapshot.annual.flatMap(annual=>{
    if(!annual.start_date || annual.as_of>cutoff || annual.inflation===null || !Number.isFinite(annual.inflation) || annual.inflation<=-1)return [];
    const start=snapshot.months.find(month=>month.month===annual.start_date!.slice(0,7)),end=snapshot.months.find(month=>month.month===annual.as_of.slice(0,7));
    if(!start || !end || start.net<=0)return [];
    const nominal=end.net/start.net-1,real=(1+nominal)/(1+annual.inflation)-1,endReal=Math.round(end.net/(1+annual.inflation));
    return [{label:String(Number(annual.as_of.slice(0,4))-1),startDate:start.as_of,endDate:end.as_of,nominal,inflation:annual.inflation,real,realGain:endReal-start.net,endReal}];
  });
}

export function cpiGrowthPeriods(snapshot:FinanceSnapshot,inflation:InflationSeries):RealGrowthPeriod[] {
  const cutoff=snapshot.selected?.month || '';
  return snapshot.months.flatMap(end=>{
    if(end.month>cutoff)return [];
    const yearAgo=`${Number(end.month.slice(0,4))-1}${end.month.slice(4)}`,start=snapshot.months.find(month=>month.month===yearAgo),cpi=inflation.monthly.find(value=>value.month===end.month);
    if(!start || start.net<=0 || !cpi)return [];
    const nominal=end.net/start.net-1,real=(1+nominal)/(1+cpi.yoy)-1,endReal=Math.round(end.net/(1+cpi.yoy));
    return [{label:end.month,startDate:start.as_of,endDate:end.as_of,nominal,inflation:cpi.yoy,real,realGain:endReal-start.net,endReal}];
  });
}
