import type { FinanceAccount, FinanceBalance } from './types.ts';
import { COLLECTR_ACCOUNT_ID,ETORO_ACCOUNT_ID } from './market-types.ts';
import type { FinanceMarket } from './market-types.ts';
import { LEGO_ACCOUNT_ID } from './lego-types.ts';
import { moneyInput } from './types.ts';

export function newMonthAmount(account:FinanceAccount,stored:FinanceBalance|undefined,market:FinanceMarket|undefined,legoTotal:number|undefined):number|undefined {
  if(account.id===COLLECTR_ACCOUNT_ID)return market?.collectr?.usdMinor;
  if(account.id===ETORO_ACCOUNT_ID)return market?.etoro?.usdMinor;
  if(account.id===LEGO_ACCOUNT_ID)return legoTotal;
  if(account.kind==='debt' && ['cashflow-row-5','cashflow-row-6','cashflow-row-7','cashflow-row-8'].includes(account.id))return stored?.amount_minor;
  return undefined;
}
export function marketRefreshAmount(account:FinanceAccount,newMonth:boolean,dirty:boolean,currency:'HUF'|'USD',market:FinanceMarket|undefined):string|null {
  if(!newMonth || dirty || currency!=='USD' || ![COLLECTR_ACCOUNT_ID,ETORO_ACCOUNT_ID].includes(account.id))return null;
  return moneyInput(newMonthAmount(account,undefined,market,undefined));
}
