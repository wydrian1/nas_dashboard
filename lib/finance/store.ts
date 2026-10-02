import type { DatabaseSync } from 'node:sqlite';
import { plainSqlRow } from '../sql-rows.ts';
import { FinanceInputError, parseMoney, validDate, validMonth } from './types.ts';
import type { FinanceAccount, FinanceAnnual, FinanceBalance, FinanceMonth, FinancePoint, FinanceSnapshot } from './types.ts';

export function readFinanceSnapshot(db:DatabaseSync,month?:string):FinanceSnapshot {
  const accounts=(db.prepare('SELECT * FROM finance_accounts ORDER BY sort_order,id').all() as FinanceAccount[]).map(plainSqlRow);
  const months=(db.prepare(`SELECT m.*,COALESCE(SUM(CASE WHEN a.kind='asset' THEN b.amount_minor ELSE 0 END),0) AS assets,
    COALESCE(SUM(CASE WHEN a.kind='debt' THEN b.amount_minor ELSE 0 END),0) AS debt,
    COALESCE(SUM(b.amount_minor),0) AS net
    FROM finance_months m LEFT JOIN finance_balances b ON b.month=m.month LEFT JOIN finance_accounts a ON a.id=b.account_id
    GROUP BY m.month ORDER BY m.month`).all() as FinancePoint[]).map(plainSqlRow);
  const selected=(month ? months.find(item=>item.month===validMonth(month)) : months.at(-1)) || null;
  const index=selected ? months.findIndex(item=>item.month===selected.month) : -1;
  const previous=index>0 ? months[index-1] : null;
  const yearAgo=selected ? months.find(item=>item.month===`${Number(selected.month.slice(0,4))-1}${selected.month.slice(4)}`) || null : null;
  const balances=(period:FinancePoint|null)=>(period ? db.prepare('SELECT account_id,amount_minor,turnover,source_cell FROM finance_balances WHERE month=?').all(period.month) as FinanceBalance[] : []).map(plainSqlRow);
  const info=db.prepare('SELECT source_name,imported_at,summary_json FROM finance_imports ORDER BY id DESC LIMIT 1').get() as {source_name:string;imported_at:string;summary_json:string}|undefined;
  return {accounts,months,selected,previous,yearAgo,balances:balances(selected),previousBalances:balances(previous),
    annual:(db.prepare('SELECT * FROM finance_annual ORDER BY as_of').all() as FinanceAnnual[]).map(plainSqlRow),
    turnovers:(db.prepare('SELECT month,account_id,amount_minor FROM finance_balances WHERE turnover=1 ORDER BY month DESC').all() as {month:string;account_id:string;amount_minor:number}[]).map(plainSqlRow),
    portfolioLabels:info ? JSON.parse(info.summary_json).portfolioLabels || [] : [],
    importInfo:info ? {source_name:info.source_name,imported_at:info.imported_at,summary_json:info.summary_json} : null};
}

export function saveFinanceMonth(db:DatabaseSync,data:FormData,actor:string,now=new Date().toISOString(),fx?:{date:string;usdHuf:number}):string {
  const month=validMonth(data.get('month')),asOf=validDate(data.get('as_of'));
  if(asOf.slice(0,7)!==month)throw new FinanceInputError('Az állapotdátum a választott hónapba essen.');
  const revision=data.get('revision');
  if(typeof revision!=='string' || !/^\d{1,9}$/.test(revision))throw new FinanceInputError('Érvénytelen verzió. Frissítsd az oldalt.');
  const note=data.get('note');if(typeof note!=='string' || note.length>3000)throw new FinanceInputError('A megjegyzés legfeljebb 3000 karakter lehet.');
  if(data.get('confirmed')!=='on')throw new FinanceInputError('Mentés előtt erősítsd meg, hogy ellenőrizted az összegeket.');
  const accounts=db.prepare('SELECT * FROM finance_accounts ORDER BY sort_order,id').all() as FinanceAccount[];
  if(!accounts.length)throw new FinanceInputError('Előbb importálni kell a kiinduló táblázatot.');
  const known=new Set(accounts.map(account=>'amount:'+account.id));
  for(const key of data.keys())if(key.startsWith('amount:') && !known.has(key))throw new FinanceInputError('Ismeretlen pénzügyi tétel.');
  const balances:FinanceBalance[]=[];
  for(const account of accounts){
    if(data.getAll('amount:'+account.id).length!==1)throw new FinanceInputError('Hiányos vagy ismétlődő űrlapmező. Frissítsd az oldalt.');
    const amount=parseMoney(data.get('amount:'+account.id));
    const turnover=data.get('turnover:'+account.id)==='on' ? 1 : 0;
    if(turnover && (account.kind!=='debt' || !account.turnover_month || amount===null))throw new FinanceInputError('Fordulójelölés csak rögzített gyerek-DEBT összeghez adható meg.');
    if(amount!==null){
      if((account.kind==='debt' && amount>0) || (account.kind==='asset' && amount<0))throw new FinanceInputError(`${account.name}: tartozást negatív, vagyont nemnegatív összeggel rögzíts.`);
      balances.push({account_id:account.id,amount_minor:amount,turnover,source_cell:null});
    }
  }
  if(!balances.length)throw new FinanceInputError('Legalább egy összeget rögzíts.');
  const total=balances.reduce((sum,balance)=>sum+balance.amount_minor,0);
  const positive=balances.reduce((sum,balance)=>sum+Math.max(0,balance.amount_minor),0),negative=balances.reduce((sum,balance)=>sum+Math.min(0,balance.amount_minor),0);
  if(![total,positive,negative].every(Number.isSafeInteger))throw new FinanceInputError('Az összesített összeg túl nagy.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const current=db.prepare('SELECT * FROM finance_months WHERE month=?').get(month) as FinanceMonth|undefined;
    if(Number(revision)!==(current?.revision || 0))throw new FinanceInputError('Ezt a hónapot közben módosították vagy már létrehozták. Frissítsd az oldalt, az adatokat nem írtam felül.');
    const oldBalances=current ? db.prepare('SELECT * FROM finance_balances WHERE month=? ORDER BY account_id').all(month) : [];
    db.prepare(`INSERT INTO finance_months(month,as_of,source,note,revision,updated_at) VALUES(?,?,'manual',?,1,?)
      ON CONFLICT(month) DO UPDATE SET as_of=excluded.as_of,source='manual',note=excluded.note,revision=finance_months.revision+1,updated_at=excluded.updated_at`).run(month,asOf,note.trim(),now);
    db.prepare('DELETE FROM finance_balances WHERE month=?').run(month);
    const insert=db.prepare('INSERT INTO finance_balances(month,account_id,amount_minor,turnover,source_cell) VALUES(?,?,?,?,NULL)');
    for(const balance of balances)insert.run(month,balance.account_id,balance.amount_minor,balance.turnover);
    db.prepare('INSERT INTO finance_audit(month,actor,action,before_json,after_json,occurred_at) VALUES(?,?,?,?,?,?)').run(month,actor,current ? 'edit' : 'create',current ? JSON.stringify({month:current,balances:oldBalances}) : null,JSON.stringify({month,asOf,note:note.trim(),balances,...(fx ? {conversion:{date:fx.date,usdHuf:fx.usdHuf,provider:'ECB / Frankfurter'}} : {})}),now);
    db.exec('COMMIT');return month;
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function addFinanceAccount(db:DatabaseSync,data:FormData,actor:string,id:string,now=new Date().toISOString()) {
  const name=data.get('name'),category=data.get('category'),kind=data.get('kind'),turnover=data.get('turnover_month');
  if(typeof name!=='string' || !name.trim() || name.length>120 || typeof category!=='string' || !category.trim() || category.length>80 || !['asset','debt'].includes(String(kind)))throw new FinanceInputError('Érvényes nevet, kategóriát és típust adj meg.');
  const turn=turnover==='' || turnover===null ? null : Number(turnover);
  if(turn!==null && (kind!=='debt' || typeof turnover!=='string' || !/^([1-9]|1[0-2])$/.test(turnover)))throw new FinanceInputError('Fordulóhónap csak tartozásnál, 1–12 között adható meg.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const count=Number(db.prepare('SELECT count(*) AS n FROM finance_accounts').get()!.n);
    if(count>=150)throw new FinanceInputError('Legfeljebb 150 pénzügyi tétel rögzíthető.');
    const sort=Number(db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM finance_accounts').get()!.n);
    db.prepare('INSERT INTO finance_accounts VALUES(?,?,?,?,?,?)').run(id,name.trim(),category.trim(),String(kind),sort,turn);
    db.prepare('INSERT INTO finance_audit(month,actor,action,before_json,after_json,occurred_at) VALUES(?,?,?,?,?,?)').run('',actor,'account-create',null,JSON.stringify({id,name:name.trim(),category:category.trim(),kind,turnover_month:turn}),now);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
