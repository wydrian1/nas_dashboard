export type FinanceAccount = { id:string; name:string; category:string; kind:'asset'|'debt'; sort_order:number; turnover_month:number|null };
export type FinanceBalance = { account_id:string; amount_minor:number; turnover:number; source_cell:string|null };
export type FinanceMonth = { month:string; as_of:string; source:'excel'|'manual'; excel_total_minor:number|null; note:string; revision:number; updated_at:string };
export type FinancePoint = FinanceMonth & { assets:number; debt:number; net:number };
export type FinanceAnnual = { as_of:string; start_date:string|null; excel_total_minor:number; nominal:number|null; inflation:number|null; excel_real:number|null };
export type FinanceSnapshot = {
  accounts:FinanceAccount[]; months:FinancePoint[]; selected:FinancePoint|null; previous:FinancePoint|null; yearAgo:FinancePoint|null;
  balances:FinanceBalance[]; previousBalances:FinanceBalance[]; annual:FinanceAnnual[];
  turnovers:{month:string;account_id:string;amount_minor:number}[];
  portfolioLabels:string[]; importInfo:{source_name:string; imported_at:string; summary_json:string}|null;
};
export class FinanceInputError extends Error {}
export function validMonth(value:unknown):string {
  if(typeof value!=='string' || !/^(20\d{2}|19\d{2})-(0[1-9]|1[0-2])$/.test(value))throw new FinanceInputError('Érvényes hónapot adj meg (ÉÉÉÉ-HH).');
  return value;
}
export function validDate(value:unknown):string {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value+'T00:00:00Z')) || new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new FinanceInputError('Érvényes állapotdátumot adj meg.');
  validMonth(value.slice(0,7));return value;
}
// Integer hundredths of a forint; no floating-point accumulation of balances.
export function parseMoney(value:unknown):number|null {
  if(typeof value!=='string')throw new FinanceInputError('Az összeget szöveges számként add meg.');
  const text=value.trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
  if(!text)return null;
  if(!/^-?\d{1,13}(\.\d{1,2})?$/.test(text))throw new FinanceInputError('Az összeg legfeljebb két tizedesjegyű szám lehet, Ft-ban.');
  const negative=text.startsWith('-'),[whole,fraction='']=text.replace('-','').split('.');
  const minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(minor) || minor>100_000_000_000_000)throw new FinanceInputError('Az összeg túl nagy.');
  return negative ? -minor : minor;
}
export function moneyInput(minor:number|null|undefined):string {return minor===null || minor===undefined ? '' : (minor/100).toFixed(minor%100 ? 2 : 0);}
export function formatMoney(minor:number):string {return new Intl.NumberFormat('hu-HU',{style:'currency',currency:'HUF',maximumFractionDigits:minor%100 ? 2 : 0}).format(minor/100);}
export function formatMonth(month:string):string {return new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));}
export function nextMonth(month:string):string {validMonth(month);const date=new Date(month+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,7);}
export function changeRatio(current:number,previous:number):number|null {return previous>0 ? (current-previous)/previous : null;}
export function formatPercent(ratio:number|null):string {return ratio===null ? '—' : new Intl.NumberFormat('hu-HU',{style:'percent',maximumFractionDigits:2,signDisplay:'exceptZero'}).format(ratio);}
export function visibleFinanceNote(note:string):string {return note.split('\n').filter(line=>line!=='Az Excel összesítése a fejléc dátum-sorszámát is tartalmazza. A dashboard a tényleges tételek összegét használja.').join('\n');}

export function nextTurnoverMonth(account:FinanceAccount,from:string):string|null {
  if(!account.turnover_month)return null;validMonth(from);
  const year=Number(from.slice(0,4))+(account.turnover_month<Number(from.slice(5,7)) ? 1 : 0);
  return `${year}-${String(account.turnover_month).padStart(2,'0')}`;
}
