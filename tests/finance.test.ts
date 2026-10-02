import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initializeFinance } from '../lib/finance/schema.ts';
import { addFinanceAccount, readFinanceSnapshot, saveFinanceMonth } from '../lib/finance/store.ts';
import { excelDate, importFinanceWorkbook, parseFinanceWorkbook, type WorkbookPackage } from '../lib/finance/workbook.ts';
import { parseMoney, nextMonth, nextTurnoverMonth, validDate, validMonth, changeRatio } from '../lib/finance/types.ts';

export function fixture():WorkbookPackage {
  const serial=(date:string)=>String((Date.parse(date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000);
  const date1=serial('2025-12-05'),date2=serial('2026-01-06');
  const row=(n:number,cells:string)=>`<row r="${n}">${cells}</row>`;
  const num=(ref:string,value:string|number,style=0)=>`<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  const str=(ref:string,value:string)=>`<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
  return {sourceName:'synthetic.xlsx',sha256:'a'.repeat(64),exportedAt:'2026-10-02T00:00:00Z',entries:{
    'xl/workbook.xml':'<workbook><sheets><sheet name="Cashflow" r:id="rId1"/><sheet name="Reálnövekedés" r:id="rId2"/><sheet name="Portfolió" r:id="rId3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/styles.xml':'<styleSheet><fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><cellXfs><xf fillId="0"/><xf fillId="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':`<worksheet><sheetData>${row(1,num('C1',date1)+num('D1',date2))}${row(3,str('A3','DEBT')+str('B3','Loan')+num('C3',-100)+num('D3',-90))}${row(5,str('B5','Child')+num('C5',-20,1)+num('D5',-20))}${row(6,str('B6','Child')+'<c r="C6" s="1"/>'+num('D6',-30,1))}${row(10,str('B10','Bank')+num('C10',1000)+num('D10',1200))}${row(15,str('A15','INVEST')+str('B15','Bond')+num('C15',100)+num('D15',150))}${row(45,str('A45','Collectibles')+num('D45',40))}${row(48,num('C48',980)+num('D48',1250+Number(date2)))}${row(62,str('D62','Note'))}</sheetData></worksheet>`,
    'xl/worksheets/sheet2.xml':`<worksheet><sheetData>${row(2,num('A2',date1)+num('B2',980))}${row(3,num('A3',date2)+num('B3',1250)+num('C3',.2)+num('D3',.1)+num('E3',.1))}</sheetData></worksheet>`,
    'xl/worksheets/sheet3.xml':`<worksheet><sheetData>${row(2,str('A2','Bond'))}</sheetData></worksheet>`
  }};
}
function database(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');initializeFinance(db);importFinanceWorkbook(db,fixture());return db;}
function form(db:DatabaseSync,month='2026-02',revision='0') {
  const data=new FormData();data.set('month',month);data.set('as_of',month+'-05');data.set('revision',revision);data.set('note','Monthly review');data.set('confirmed','on');
  for(const account of readFinanceSnapshot(db).accounts)data.set('amount:'+account.id,account.kind==='debt' ? '-10' : '100');
  return data;
}

test('finance money/date helpers use exact minor units and reject ambiguous or invalid inputs',()=>{
  assert.equal(parseMoney('1 234,56'),123456);assert.equal(parseMoney('-123.45'),-12345);assert.equal(parseMoney(''),null);
  for(const invalid of ['1,234.56','1e6','NaN','1.234','--2','1 Ft'])assert.throws(()=>parseMoney(invalid));
  assert.throws(()=>validDate('2026-02-30'));assert.throws(()=>validMonth('2026-13'));assert.equal(validDate('2024-02-29'),'2024-02-29');
  assert.equal(nextMonth('2026-12'),'2027-01');assert.equal(changeRatio(120,100),.2);assert.equal(changeRatio(2,0),null);
  assert.equal(excelDate(46271),'2026-09-06');
});
test('finance importer preserves blanks, duplicate accounts, original totals, styles, annual values and source archive',()=>{
  const source=fixture(),parsed=parseFinanceWorkbook(source);assert.equal(parsed.accounts.length,6);assert.equal(parsed.months.length,2);
  assert.equal(parsed.months[0].net,98000);assert.equal(parsed.months[1].net,125000);assert.equal(parsed.summary.correctedMonths,1);assert.equal(parsed.summary.turnoverMarkers,2);
  assert.deepEqual(parsed.accounts.filter(a=>a.name.startsWith('Child')).map(a=>[a.name,a.turnover_month]),[['Child · 1',12],['Child · 2',1]]);
  assert.equal(parsed.months[0].balances.some(b=>b.account_id==='cashflow-row-6'),false);
  assert.equal(parsed.annual[1].excel_real,.1);assert.equal(parsed.annual[1].start_date,'2025-12-05');assert.deepEqual(parsed.portfolioLabels,['Bond']);
  const db=database();try{assert.deepEqual(JSON.parse(String(db.prepare('SELECT workbook_json FROM finance_imports').get()!.workbook_json)),source);}finally{db.close();}
});
test('finance import is idempotent and refuses changed workbooks instead of overwriting manual or existing history',()=>{
  const db=database();try{
    assert.equal(importFinanceWorkbook(db,fixture()).alreadyImported,true);assert.equal(db.prepare('SELECT count(*) AS n FROM finance_balances').get()!.n,10);
    assert.throws(()=>importFinanceWorkbook(db,{...fixture(),sha256:'b'.repeat(64)}));assert.equal(db.prepare('SELECT count(*) AS n FROM finance_imports').get()!.n,1);
  }finally{db.close();}
});
test('finance importer rejects errors, missing cached formulas, unexpected reconciliation, repeated months and external XML',()=>{
  const original=fixture();for(const [before,after] of [['<v>-90</v>','<v>90</v>'],['<v>1200</v>','<f>SUM(A1:A2)</f>'],['<v>980</v>','<v>981</v>']]){
    const source=structuredClone(original);source.entries['xl/worksheets/sheet1.xml']=source.entries['xl/worksheets/sheet1.xml'].replace(before,after);assert.throws(()=>parseFinanceWorkbook(source));
  }
  const malicious=structuredClone(original);malicious.entries['xl/styles.xml']='<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///C:/secret">]>'+malicious.entries['xl/styles.xml'];assert.throws(()=>parseFinanceWorkbook(malicious));
});
test('finance snapshot defaults to latest, supports arbitrary history, sums corrected values and keeps negative liabilities',()=>{
  const db=database();try{
    const snapshot=readFinanceSnapshot(db);assert.equal(snapshot.selected!.month,'2026-01');assert.equal(snapshot.selected!.net,125000);assert.equal(snapshot.selected!.debt,-14000);assert.equal(snapshot.selected!.assets,139000);
    assert.equal(snapshot.previous!.month,'2025-12');assert.equal(readFinanceSnapshot(db,'2025-12').previous,null);assert.equal(readFinanceSnapshot(db,'2024-01').selected,null);
    assert.equal(snapshot.turnovers.length,2);assert.equal(snapshot.yearAgo,null);assert.equal(Object.getPrototypeOf(snapshot.accounts[0]),Object.prototype);
  }finally{db.close();}
});
test('finance manually adds a month, audits author, uses integer balances and leaves older months unchanged',()=>{
  const db=database();try{
    const before=readFinanceSnapshot(db,'2026-01'),data=form(db);data.set('amount:cashflow-row-10','123,45');data.set('turnover:cashflow-row-5','on');
    assert.equal(saveFinanceMonth(db,data,'admin@example.com'),'2026-02');
    assert.equal(readFinanceSnapshot(db).selected!.source,'manual');assert.equal(readFinanceSnapshot(db).selected!.net,29345);
    assert.deepEqual(readFinanceSnapshot(db,'2026-01').balances,before.balances);assert.equal(readFinanceSnapshot(db).selected!.excel_total_minor,null);
    const audit=db.prepare('SELECT actor,action FROM finance_audit').get()!;assert.equal(audit.actor,'admin@example.com');assert.equal(audit.action,'create');
  }finally{db.close();}
});
test('finance edits require matching revision, preserve original imported total, and reject stale forms atomically',()=>{
  const db=database();try{
    const sourceTotal=readFinanceSnapshot(db).selected!.excel_total_minor;saveFinanceMonth(db,form(db,'2026-01','1'),'admin@example.com');
    const current=readFinanceSnapshot(db);assert.equal(current.selected!.revision,2);assert.equal(current.selected!.excel_total_minor,sourceTotal);
    assert.throws(()=>saveFinanceMonth(db,form(db,'2026-01','1'),'admin@example.com'),/közben/);assert.deepEqual(readFinanceSnapshot(db),current);
    const audit=db.prepare('SELECT before_json FROM finance_audit').get()!;assert.ok(JSON.parse(String(audit.before_json)).balances.length);
  }finally{db.close();}
});
test('finance validation rejects incomplete forms, wrong sign, missing confirmation and wrong date without partial changes',()=>{
  const db=database();try{
    const cases=[(d:FormData)=>d.delete('confirmed'),(d:FormData)=>d.set('as_of','2026-03-05'),(d:FormData)=>d.set('amount:cashflow-row-3','10'),(d:FormData)=>d.set('amount:cashflow-row-10','-10'),(d:FormData)=>d.delete('amount:cashflow-row-10'),(d:FormData)=>d.append('amount:unknown','1'),(d:FormData)=>d.append('amount:cashflow-row-10','1'),(d:FormData)=>d.set('turnover:cashflow-row-10','on')];
    const before=readFinanceSnapshot(db);for(const change of cases){const data=form(db);change(data);assert.throws(()=>saveFinanceMonth(db,data,'admin'));assert.deepEqual(readFinanceSnapshot(db),before);}
    assert.equal(db.prepare('SELECT count(*) AS n FROM finance_audit').get()!.n,0);
  }finally{db.close();}
});
test('finance blank and zero balances stay distinct, and annual-month scheduling does not invent an exact day',()=>{
  const db=database();try{
    const data=form(db);data.set('amount:cashflow-row-10','');data.set('amount:cashflow-row-15','0');saveFinanceMonth(db,data,'admin');
    assert.equal(readFinanceSnapshot(db).balances.some(b=>b.account_id==='cashflow-row-10'),false);assert.equal(readFinanceSnapshot(db).balances.find(b=>b.account_id==='cashflow-row-15')!.amount_minor,0);
    const child=readFinanceSnapshot(db).accounts.find(a=>a.id==='cashflow-row-5')!;
    assert.equal(nextTurnoverMonth(child,'2026-11'),'2026-12');assert.equal(nextTurnoverMonth(child,'2026-12'),'2026-12');assert.equal(nextTurnoverMonth(child,'2027-01'),'2027-12');
  }finally{db.close();}
});
test('finance new accounts are audited without altering past months and reject invalid turnover configurations',()=>{
  const db=database();try{
    const data=new FormData();data.set('name','New bank');data.set('category','Banks');data.set('kind','asset');data.set('turnover_month','');
    const old=readFinanceSnapshot(db).balances;addFinanceAccount(db,data,'admin','new-account');assert.deepEqual(readFinanceSnapshot(db).balances,old);assert.equal(readFinanceSnapshot(db).accounts.length,7);
    data.set('turnover_month','13');assert.throws(()=>addFinanceAccount(db,data,'admin','invalid'));data.set('turnover_month','2');assert.throws(()=>addFinanceAccount(db,data,'admin','invalid'));
    assert.equal(db.prepare('SELECT count(*) AS n FROM finance_audit').get()!.n,1);
  }finally{db.close();}
});
