import { XMLParser } from 'fast-xml-parser';
import type { DatabaseSync } from 'node:sqlite';
import { initializeFinance } from './schema.ts';
import { FinanceInputError, validDate, validMonth } from './types.ts';
import type { FinanceAccount, FinanceAnnual, FinanceBalance } from './types.ts';

export type WorkbookPackage = {sourceName:string;sha256:string;exportedAt:string;entries:Record<string,string>};
type Cell = {r:string;s?:string;t?:string;v?:string;is?:unknown;f?:unknown};
type ImportedMonth = {month:string;asOf:string;excelTotal:number;net:number;balances:FinanceBalance[];notes:string[]};
export type ParsedFinanceWorkbook = {accounts:FinanceAccount[];months:ImportedMonth[];annual:FinanceAnnual[];portfolioLabels:string[];summary:{monthCount:number;accountCount:number;firstMonth:string;lastMonth:string;turnoverMarkers:number;correctedMonths:number;portfolioLabels:string[]}};
const list=<T>(value:T|T[]|undefined):T[]=>value===undefined ? [] : Array.isArray(value) ? value : [value];
const text=(value:any):string=>typeof value==='string' ? value : value?.['#text'] || '';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,processEntities:false});

export function excelDate(value:number):string {
  if(!Number.isFinite(value) || value<36526 || value>73050 || !Number.isInteger(value))throw new FinanceInputError('Érvénytelen Excel-dátum.');
  return validDate(new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10));
}
function minor(value:unknown,cell:string):number {
  if(typeof value!=='string' || !value.trim())throw new FinanceInputError(`Hiányzik a számított érték: ${cell}. Mentsd újra az Excelt számított képletekkel.`);
  const number=Number(value),result=Math.round(number*100);
  if(!Number.isFinite(number) || !Number.isSafeInteger(result) || Math.abs(result)>100_000_000_000_000 || Math.abs(number*100-result)>.001)throw new FinanceInputError(`Érvénytelen vagy túl pontos összeg: ${cell}.`);
  return result;
}
function category(row:number):string {
  if(row<=8)return 'Tartozások';if(row<=13)return 'Bankszámlák';if(row<=16)return 'Állampapír';if(row<=19)return 'Kripto';
  if(row<=35)return 'Részvények / alapok';if(row===37)return 'SZÉP-kártya';if(row<=40)return 'Lakástakarék';if(row<=42)return 'Egészségpénztár';if(row<=44)return 'Nyugdíj';return 'Gyűjtemények';
}

export function parseFinanceWorkbook(source:WorkbookPackage):ParsedFinanceWorkbook {
  if(!source || !/^[a-f0-9]{64}$/.test(source.sha256) || typeof source.sourceName!=='string' || !source.entries || Object.keys(source.entries).length>30)throw new FinanceInputError('Érvénytelen munkafüzetcsomag.');
  const xml=(path:string)=>{const value=source.entries[path];if(typeof value!=='string' || value.length>10_000_000 || /<!DOCTYPE|<!ENTITY/i.test(value))throw new FinanceInputError('Hiányzó vagy nem támogatott XML: '+path);return parser.parse(value);};
  const workbook=xml('xl/workbook.xml').workbook;
  if(['1','true'].includes(workbook.workbookPr?.date1904))throw new FinanceInputError('Az 1904-es dátumrendszer nem támogatott.');
  const rels=list<any>(xml('xl/_rels/workbook.xml.rels').Relationships.Relationship);
  const sheets=list<any>(workbook.sheets.sheet);
  const sheet=(name:string)=>{
    const meta=sheets.find(item=>item.name===name);if(!meta)throw new FinanceInputError('Hiányzó munkalap: '+name);
    const rel=rels.find(item=>item.Id===meta['r:id']);if(!rel || rel.TargetMode==='External')throw new FinanceInputError('Érvénytelen munkalap-hivatkozás.');
    const path='xl/'+String(rel.Target).replace(/^\/?xl\//,'');
    if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(path))throw new FinanceInputError('Nem támogatott munkalapútvonal.');
    return xml(path).worksheet;
  };
  const strings=source.entries['xl/sharedStrings.xml'] ? list<any>(xml('xl/sharedStrings.xml').sst.si).map(si=>si.t!==undefined ? text(si.t) : list<any>(si.r).map(run=>text(run.t)).join('')) : [];
  const label=(cell:Cell|undefined)=>!cell ? '' : cell.t==='s' ? strings[Number(cell.v)] || '' : cell.t==='inlineStr' ? text((cell.is as any)?.t) : text(cell.v);
  const cells=(sheet:any)=>new Map<string,Cell>(list<any>(sheet.sheetData?.row).flatMap(row=>list<Cell>(row.c)).map(cell=>[cell.r,cell]));
  const cash=cells(sheet('Cashflow')),styleSheet=xml('xl/styles.xml').styleSheet,styles=list<any>(styleSheet.cellXfs.xf),fills=list<any>(styleSheet.fills.fill);
  const isTurnover=(cell:Cell|undefined)=>{const fill=fills[Number(styles[Number(cell?.s || 0)]?.fillId)];return fill?.patternFill?.patternType==='solid' && String(fill.patternFill?.fgColor?.rgb || '').slice(-6).toUpperCase()==='FFFF00';};
  if(label(cash.get('A3'))!=='DEBT' || label(cash.get('A15'))!=='INVEST')throw new FinanceInputError('A Cashflow szerkezete eltér a jóváhagyott táblázattól.');
  const columns=[...cash.values()].filter(cell=>/^[A-Z]+1$/.test(cell.r) && cell.v!==undefined).map(cell=>({col:cell.r.slice(0,-1),asOf:excelDate(Number(cell.v)),serial:Number(cell.v)}));
  if(!columns.length || columns.length>1200)throw new FinanceInputError('Nincsenek importálható hónapok.');
  const seen=new Set<string>();let last='';
  for(const column of columns){const month=validMonth(column.asOf.slice(0,7));if(seen.has(month) || month<=last)throw new FinanceInputError('Ismétlődő vagy rendezetlen hónapok.');seen.add(month);last=month;}
  const rows=Array.from({length:44},(_,index)=>index+3).filter(row=>label(cash.get('B'+row)) || ([45,46].includes(row) && label(cash.get('A'+row))));
  const rawNames=rows.map(row=>label(cash.get('B'+row)) || label(cash.get('A'+row)));
  const occurrences=new Map<string,number>();
  const accounts:FinanceAccount[]=rows.map((row,index)=>{
    const rawName=rawNames[index],duplicate=rawNames.filter(name=>name===rawName).length>1,n=(occurrences.get(rawName) || 0)+1;occurrences.set(rawName,n);
    const turns=columns.filter(({col})=>cash.get(col+row)?.v!==undefined && isTurnover(cash.get(col+row))).map(column=>Number(column.asOf.slice(5,7)));
    if(new Set(turns).size>1)throw new FinanceInputError('Több eltérő fordulóhónap: '+rawName);
    return {id:'cashflow-row-'+row,name:rawName+(duplicate ? ' · '+n : ''),category:category(row),kind:row<=8 ? 'debt' : 'asset',sort_order:row,turnover_month:turns[0] || null};
  });
  let markerCount=0,correctedMonths=0;
  const months:ImportedMonth[]=columns.map(({col,asOf,serial})=>{
    const balances:FinanceBalance[]=[];
    rows.forEach((row,index)=>{
      const cell=cash.get(col+row);if(!cell || (cell.v===undefined && cell.f===undefined))return;
      if(cell.t==='e' || cell.t==='s')throw new FinanceInputError('Nem szám vagy Excel-hiba: '+cell.r);
      const amount=minor(cell.v,cell.r),account=accounts[index];
      if((account.kind==='debt' && amount>0) || (account.kind==='asset' && amount<0))throw new FinanceInputError('Váratlan előjel: '+cell.r);
      const turnover=account.kind==='debt' && isTurnover(cell) ? 1 : 0;markerCount+=turnover;
      balances.push({account_id:account.id,amount_minor:amount,turnover,source_cell:cell.r});
    });
    const net=balances.reduce((sum,value)=>sum+value.amount_minor,0),excelTotal=minor(cash.get(col+'48')?.v,col+'48'),difference=excelTotal-net,notes:string[]=[];
    if(!Number.isSafeInteger(net))throw new FinanceInputError('Túl nagy összegzés.');
    if(difference){correctedMonths++;if(difference!==serial*100)throw new FinanceInputError('Nem magyarázható összesítési eltérés: '+col+'48');notes.push('Az Excel összesítése a fejléc dátum-sorszámát is tartalmazza. A dashboard a tényleges tételek összegét használja.');}
    const note=label(cash.get(col+'62'));if(note)notes.push(note);
    return {month:asOf.slice(0,7),asOf,excelTotal,net,balances,notes};
  });
  const annualCells=cells(sheet('Reálnövekedés')),annual:FinanceAnnual[]=[];
  for(let row=2;row<=100;row++){
    const date=annualCells.get('A'+row);if(date?.v===undefined)continue;
    const rate=(col:string)=>{const cell=annualCells.get(col+row);if(!cell || cell.v===undefined)return null;const n=Number(cell.v);if(cell.t==='e' || !Number.isFinite(n))throw new FinanceInputError('Hibás éves mutató.');return n;};
    annual.push({as_of:excelDate(Number(date.v)),start_date:annual.at(-1)?.as_of || null,excel_total_minor:minor(annualCells.get('B'+row)?.v,'B'+row),nominal:rate('C'),inflation:rate('D'),excel_real:rate('E')});
  }
  const portfolioLabels=[...cells(sheet('Portfolió')).values()].map(label).filter(Boolean);
  return {accounts,months,annual,portfolioLabels,summary:{monthCount:months.length,accountCount:accounts.length,firstMonth:months[0].month,lastMonth:months.at(-1)!.month,turnoverMarkers:markerCount,correctedMonths,portfolioLabels}};
}

export function importFinanceWorkbook(db:DatabaseSync,source:WorkbookPackage,now=new Date().toISOString()) {
  const parsed=parseFinanceWorkbook(source);initializeFinance(db);
  db.exec('BEGIN IMMEDIATE');
  try{
    if(db.prepare('SELECT id FROM finance_imports WHERE checksum=?').get(source.sha256)){db.exec('COMMIT');return {...parsed.summary,alreadyImported:true};}
    if(Number(db.prepare('SELECT count(*) AS n FROM finance_months').get()!.n) || Number(db.prepare('SELECT count(*) AS n FROM finance_accounts').get()!.n))throw new FinanceInputError('A pénzügyi adatbázis már tartalmaz adatokat. Az import nem írhat felül meglévő hónapokat; használd a havi kézi rögzítést.');
    const result=db.prepare('INSERT INTO finance_imports(checksum,source_name,imported_at,summary_json,workbook_json) VALUES(?,?,?,?,?)').run(source.sha256,source.sourceName,now,JSON.stringify(parsed.summary),JSON.stringify(source));
    const insertAccount=db.prepare('INSERT INTO finance_accounts VALUES(?,?,?,?,?,?)');
    for(const account of parsed.accounts)insertAccount.run(account.id,account.name,account.category,account.kind,account.sort_order,account.turnover_month);
    const insertMonth=db.prepare("INSERT INTO finance_months(month,as_of,source,source_import_id,excel_total_minor,note,updated_at) VALUES(?,?,'excel',?,?,?,?)"),insertBalance=db.prepare('INSERT INTO finance_balances VALUES(?,?,?,?,?)');
    for(const month of parsed.months){
      insertMonth.run(month.month,month.asOf,result.lastInsertRowid,month.excelTotal,month.notes.join('\n'),now);
      for(const balance of month.balances)insertBalance.run(month.month,balance.account_id,balance.amount_minor,balance.turnover,balance.source_cell);
    }
    const insertAnnual=db.prepare('INSERT INTO finance_annual VALUES(?,?,?,?,?,?)');
    for(const period of parsed.annual)insertAnnual.run(period.as_of,period.start_date,period.excel_total_minor,period.nominal,period.inflation,period.excel_real);
    db.exec('COMMIT');return {...parsed.summary,alreadyImported:false};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
