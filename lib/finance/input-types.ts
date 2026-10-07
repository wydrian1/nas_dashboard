import { FinanceInputError, parseMoney } from './types.ts';

// These are grouping separators, never a decimal mark in manual amount fields.
export function normalizeIntegerInput(value:string):string {return value.replace(/[\s,.]/g,'');}
export function integerMoneyInput(minor:number|null|undefined):string {return minor===null || minor===undefined ? '' : String(Math.floor(minor/100));}
export function parseIntegerMoney(value:unknown):number|null {
  if(typeof value!=='string')throw new FinanceInputError('Az összeget egész számként add meg.');
  const text=normalizeIntegerInput(value);
  if(text && !/^-?\d+$/.test(text))throw new FinanceInputError('Csak egész összeget adhatsz meg.');
  return parseMoney(text);
}
