import type {DatabaseSync} from 'node:sqlite';
import {requireAccess,normalizeEmail} from '../users.ts';
import {sanitizeInfoHtml,ImportantInfoError} from './html.ts';
export {ImportantInfoError};
export type ImportantInfoDocument={html:string;revision:number;updated_at:string|null};
export type InfoAccount={id:string;name:string;category:string;kind:'asset'|'debt';amountMinor:number|null};
export type InfoGroup={category:string;totalMinor:number;items:InfoAccount[]};
export type LatestInfoFinance={month:string;asOf:string;netMinor:number;assetsMinor:number;debtMinor:number;groups:InfoGroup[]}|null;
export function readImportantInfo(db:DatabaseSync,email:string){
  requireAccess(db,email,'important-info');
  const row=db.prepare('SELECT html,revision,updated_at FROM important_info WHERE id=1').get() as ImportantInfoDocument|undefined;
  return row ? {...row,html:sanitizeInfoHtml(row.html)} : {html:'',revision:0,updated_at:null};
}
export function saveImportantInfo(db:DatabaseSync,email:string,htmlInput:unknown,revisionInput:unknown,now=new Date().toISOString()){
  requireAccess(db,email,'admin');
  if(typeof revisionInput!=='string'||!/^\d{1,9}$/.test(revisionInput))throw new ImportantInfoError('Érvénytelen szövegverzió. Frissítsd az oldalt.');
  const html=sanitizeInfoHtml(htmlInput),revision=Number(revisionInput);
  db.exec('BEGIN IMMEDIATE');try{
    const current=db.prepare('SELECT html,revision FROM important_info WHERE id=1').get() as {html:string;revision:number}|undefined;
    if(revision!==(current?.revision || 0))throw new ImportantInfoError('Közben másik admin módosította a szöveget. Az újabb változatot nem írtam felül; másold ki a saját szövegedet, majd frissítsd az oldalt.');
    db.prepare('INSERT INTO important_info VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET html=excluded.html,revision=excluded.revision,updated_at=excluded.updated_at').run(html,revision+1,now);
    db.prepare('INSERT INTO important_info_audit(actor,before_html,after_html,revision,occurred_at) VALUES(?,?,?,?,?)').run(normalizeEmail(email),current?.html || '',html,revision+1,now);
    db.exec('COMMIT');return revision+1;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function readLatestInfoFinance(db:DatabaseSync,email:string):LatestInfoFinance {
  requireAccess(db,email,'important-info');
  // Project only the latest saved month. No notes, older months, import paths, audit, FX or provider credentials.
  db.exec('BEGIN');try{
    const latest=db.prepare('SELECT month,as_of FROM finance_months ORDER BY month DESC LIMIT 1').get() as {month:string;as_of:string}|undefined;
    if(!latest){db.exec('COMMIT');return null;}
    const rows=db.prepare(`SELECT a.id,a.name,a.category,a.kind,b.amount_minor FROM finance_accounts a
      LEFT JOIN finance_balances b ON b.account_id=a.id AND b.month=? ORDER BY a.sort_order,a.id`).all(latest.month) as {id:string;name:string;category:string;kind:'asset'|'debt';amount_minor:number|null}[];
    const groups=new Map<string,InfoGroup>();let netMinor=0,assetsMinor=0,debtMinor=0;
    for(const row of rows){const item:InfoAccount={id:row.id,name:row.name,category:row.category,kind:row.kind,amountMinor:row.amount_minor};let group=groups.get(row.category);if(!group){group={category:row.category,totalMinor:0,items:[]};groups.set(row.category,group);}group.items.push(item);
      if(item.amountMinor!==null){group.totalMinor+=item.amountMinor;netMinor+=item.amountMinor;if(item.kind==='asset')assetsMinor+=item.amountMinor;else debtMinor+=item.amountMinor;}
    }
    if(![netMinor,assetsMinor,debtMinor,...[...groups.values()].map(group=>group.totalMinor)].every(Number.isSafeInteger))throw new ImportantInfoError('A mentett összesítés nem jeleníthető meg biztonságosan.');
    db.exec('COMMIT');return {month:latest.month,asOf:latest.as_of,netMinor,assetsMinor,debtMinor,groups:[...groups.values()]};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
