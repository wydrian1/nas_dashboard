import type { FinanceAccount, FinanceBalance } from './types.ts';
import { COLLECTR_ACCOUNT_ID,ETORO_ACCOUNT_ID } from './market-types.ts';
import type { FinanceMarket } from './market-types.ts';
import { LEGO_ACCOUNT_ID } from './lego-types.ts';
import { integerMoneyInput } from './input-types.ts';
import { usdToHuf } from './market-types.ts';

export function newMonthAmount(account:FinanceAccount,stored:FinanceBalance|undefined,market:FinanceMarket|undefined,legoTotal:number|undefined):number|undefined {
  if(account.id===COLLECTR_ACCOUNT_ID)return market?.collectr?.usdMinor;
  if(account.id===ETORO_ACCOUNT_ID)return market?.etoro?.usdMinor;
  if(account.id===LEGO_ACCOUNT_ID)return legoTotal;
  if(account.kind==='debt' && ['cashflow-row-5','cashflow-row-6','cashflow-row-7','cashflow-row-8'].includes(account.id))return stored?.amount_minor;
  return undefined;
}
export function marketRefreshAmount(account:FinanceAccount,newMonth:boolean,currency:'HUF'|'USD',market:FinanceMarket|undefined):string|null {
  if(!newMonth || ![COLLECTR_ACCOUNT_ID,ETORO_ACCOUNT_ID].includes(account.id))return null;
  const amount=newMonthAmount(account,undefined,market,undefined);
  if(amount===undefined || (currency==='HUF' && !market?.rates))return null;
  const wholeUsd=Math.floor(amount/100)*100;
  return integerMoneyInput(currency==='USD' ? wholeUsd : usdToHuf(wholeUsd,market!.rates!.usdHuf));
}
