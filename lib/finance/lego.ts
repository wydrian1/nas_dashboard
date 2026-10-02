import { randomUUID, createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { plainSqlRow } from '../sql-rows.ts';
import { FinanceInputError, parseMoney, validDate } from './types.ts';
import type { LegoItem, LegoSnapshot } from './lego-types.ts';

function field(data:FormData,name:string):string {
  const values=data.getAll(name);if(values.length!==1 || typeof values[0]!=='string')throw new FinanceInputError('Hiányos vagy ismétlődő LEGO-mező.');return values[0];
}
function details(data:FormData) {
  const set_number=field(data,'set_number').trim(),name=field(data,'name').trim(),quantityText=field(data,'quantity'),price=parseMoney(field(data,'unit_price')),date=field(data,'acquired_on').trim();
  if(!/^\d{3,10}(?:-\d{1,3})?$/.test(set_number) || !name || name.length>200)throw new FinanceInputError('Érvényes készletszámot és nevet adj meg.');
  if(!/^[1-9]\d{0,3}$/.test(quantityText))throw new FinanceInputError('A darabszám 1–9999 közötti egész szám legyen.');
  if(price===null || price<0 || price>100_000_000_000)throw new FinanceInputError('Nemnegatív Ft-egységár szükséges.');
  const quantity=Number(quantityText);if(!Number.isSafeInteger(price*quantity))throw new FinanceInputError('A LEGO-összeg túl nagy.');
  return {set_number,name,quantity,unit_price_minor:price,acquired_on:date ? validDate(date) : null};
}
export function readLego(db:DatabaseSync):LegoSnapshot {
  const items=(db.prepare('SELECT * FROM finance_lego_items WHERE deleted_at IS NULL ORDER BY acquired_on DESC,set_number,id').all() as LegoItem[]).map(plainSqlRow);
  return {items,quantity:items.reduce((n,item)=>n+item.quantity,0),totalMinor:items.reduce((n,item)=>n+item.quantity*item.unit_price_minor,0)};
}
function audit(db:DatabaseSync,id:string,actor:string,action:string,before:unknown,after:unknown,now:string) {
  db.prepare('INSERT INTO finance_lego_audit(item_id,actor,action,before_json,after_json,occurred_at) VALUES(?,?,?,?,?,?)').run(id,actor,action,before ? JSON.stringify(before) : null,JSON.stringify(after),now);
}
export function saveLego(db:DatabaseSync,data:FormData,actor:string,now=new Date().toISOString()):string {
  const id=field(data,'id'),revision=field(data,'revision'),value=details(data);
  if(!/^\d{1,9}$/.test(revision) || id.length>100)throw new FinanceInputError('Érvénytelen LEGO-verzió.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const previous=id ? db.prepare('SELECT * FROM finance_lego_items WHERE id=? AND deleted_at IS NULL').get(id) as LegoItem|undefined : undefined;
    if((id && !previous) || Number(revision)!==(previous?.revision || 0))throw new FinanceInputError('A LEGO-tételt közben módosították vagy törölték. Frissítsd az oldalt.');
    const snapshot=readLego(db);if(!previous && snapshot.items.length>=1000)throw new FinanceInputError('Legfeljebb 1000 LEGO-tétel kezelhető.');
    const total=snapshot.totalMinor-(previous ? previous.quantity*previous.unit_price_minor : 0)+value.quantity*value.unit_price_minor;
    if(!Number.isSafeInteger(total) || total>100_000_000_000_000)throw new FinanceInputError('Az összesített LEGO-érték túl nagy.');
    const itemId=previous?.id || randomUUID();
    db.prepare(`INSERT INTO finance_lego_items(id,set_number,name,quantity,unit_price_minor,acquired_on,revision,updated_at) VALUES(?,?,?,?,?,?,1,?)
      ON CONFLICT(id) DO UPDATE SET set_number=excluded.set_number,name=excluded.name,quantity=excluded.quantity,unit_price_minor=excluded.unit_price_minor,acquired_on=excluded.acquired_on,revision=finance_lego_items.revision+1,updated_at=excluded.updated_at`).run(itemId,value.set_number,value.name,value.quantity,value.unit_price_minor,value.acquired_on,now);
    audit(db,itemId,actor,previous ? 'edit' : 'create',previous,db.prepare('SELECT * FROM finance_lego_items WHERE id=?').get(itemId),now);
    db.exec('COMMIT');return itemId;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function removeLego(db:DatabaseSync,data:FormData,actor:string,now=new Date().toISOString()) {
  const id=field(data,'id'),revision=field(data,'revision');if(field(data,'confirmed')!=='on' || !/^\d{1,9}$/.test(revision))throw new FinanceInputError('Erősítsd meg a LEGO-tétel törlését.');
  db.exec('BEGIN IMMEDIATE');try{
    const previous=db.prepare('SELECT * FROM finance_lego_items WHERE id=? AND deleted_at IS NULL').get(id) as LegoItem|undefined;
    if(!previous || previous.revision!==Number(revision))throw new FinanceInputError('A LEGO-tételt közben módosították vagy törölték. Frissítsd az oldalt.');
    db.prepare('UPDATE finance_lego_items SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(now,now,id);
    audit(db,id,actor,'delete',previous,{deleted_at:now},now);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
// Explicit one-time user-list import. Repeats never resurrect deleted or overwrite edited items.
export function importLego(db:DatabaseSync,input:unknown,actor:string,now=new Date().toISOString()):number {
  if(!Array.isArray(input) || !input.length || input.length>1000)throw new FinanceInputError('Érvénytelen LEGO-import.');
  const values=input.map(row=>{
    if(!row || typeof row!=='object')throw new FinanceInputError('Érvénytelen LEGO-importsor.');
    const form=new FormData();for(const key of ['set_number','name','quantity','unit_price','acquired_on']){if(typeof row[key]!=='string')throw new FinanceInputError('A LEGO-importmezők szövegesek legyenek.');form.set(key,row[key]);}return details(form);
  });
  const checksum=createHash('sha256').update(JSON.stringify(values)).digest('hex');
  db.exec('BEGIN IMMEDIATE');try{
    if(db.prepare('SELECT 1 FROM finance_lego_imports WHERE checksum=?').get(checksum)){db.exec('COMMIT');return 0;}
    if(db.prepare('SELECT 1 FROM finance_lego_items LIMIT 1').get())throw new FinanceInputError('Meglévő LEGO-listát nem írhat felül az import; használd a szerkesztőt.');
    const total=values.reduce((n,value)=>n+value.quantity*value.unit_price_minor,0);if(!Number.isSafeInteger(total) || total>100_000_000_000_000)throw new FinanceInputError('A LEGO-importösszeg túl nagy.');
    for(const value of values){const id=randomUUID();db.prepare('INSERT INTO finance_lego_items(id,set_number,name,quantity,unit_price_minor,acquired_on,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,value.set_number,value.name,value.quantity,value.unit_price_minor,value.acquired_on,now);audit(db,id,actor,'import',null,value,now);}
    db.prepare('INSERT INTO finance_lego_imports VALUES(?,?,?)').run(checksum,now,values.length);db.exec('COMMIT');return values.length;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
