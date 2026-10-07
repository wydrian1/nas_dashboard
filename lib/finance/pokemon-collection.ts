import { randomUUID, createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { plainSqlRow } from '../sql-rows.ts';
import { FinanceInputError, validDate } from './types.ts';
import { parseIntegerMoney } from './input-types.ts';
import type { PokemonCollectionItem, PokemonCollectionSnapshot } from './pokemon-collection-types.ts';

function field(data:FormData,name:string):string {
  const values=data.getAll(name);if(values.length!==1 || typeof values[0]!=='string')throw new FinanceInputError('Hiányos vagy ismétlődő Pokémon-mező.');return values[0];
}
function details(data:FormData) {
  const name=field(data,'name').trim(),quantityText=field(data,'quantity'),price=parseIntegerMoney(field(data,'unit_price')),date=field(data,'acquired_on').trim();
  if(!name || name.length>200)throw new FinanceInputError('A megnevezés 1–200 karakter legyen.');
  if(!/^[1-9]\d{0,3}$/.test(quantityText))throw new FinanceInputError('A darabszám 1–9999 közötti egész szám legyen.');
  if(price===null || price<0 || price>100_000_000_000)throw new FinanceInputError('Nemnegatív Ft-egységár szükséges.');
  const quantity=Number(quantityText);if(!Number.isSafeInteger(price*quantity))throw new FinanceInputError('A Pokémon-összeg túl nagy.');
  return {name,quantity,unit_price_minor:price,acquired_on:date ? validDate(date) : null};
}
export function readPokemonCollection(db:DatabaseSync):PokemonCollectionSnapshot {
  const items=(db.prepare('SELECT * FROM finance_pokemon_items WHERE deleted_at IS NULL ORDER BY acquired_on DESC,name,id').all() as PokemonCollectionItem[]).map(plainSqlRow);
  return {items,quantity:items.reduce((n,item)=>n+item.quantity,0),totalMinor:items.reduce((n,item)=>n+item.quantity*item.unit_price_minor,0)};
}
function audit(db:DatabaseSync,id:string,actor:string,action:string,before:unknown,after:unknown,now:string) {
  db.prepare('INSERT INTO finance_pokemon_audit(item_id,actor,action,before_json,after_json,occurred_at) VALUES(?,?,?,?,?,?)').run(id,actor,action,before ? JSON.stringify(before) : null,JSON.stringify(after),now);
}
export function savePokemonCollection(db:DatabaseSync,data:FormData,actor:string,now=new Date().toISOString()):string {
  const id=field(data,'id'),revision=field(data,'revision'),value=details(data);
  if(!/^\d{1,9}$/.test(revision) || id.length>100)throw new FinanceInputError('Érvénytelen Pokémon-verzió.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const previous=id ? db.prepare('SELECT * FROM finance_pokemon_items WHERE id=? AND deleted_at IS NULL').get(id) as PokemonCollectionItem|undefined : undefined;
    if((id && !previous) || Number(revision)!==(previous?.revision || 0))throw new FinanceInputError('A Pokémon-tételt közben módosították vagy törölték. Frissítsd az oldalt.');
    const snapshot=readPokemonCollection(db);if(!previous && snapshot.items.length>=1000)throw new FinanceInputError('Legfeljebb 1000 Pokémon-vásárlási sor kezelhető.');
    const total=snapshot.totalMinor-(previous ? previous.quantity*previous.unit_price_minor : 0)+value.quantity*value.unit_price_minor;
    if(!Number.isSafeInteger(total) || total>100_000_000_000_000)throw new FinanceInputError('Az összesített Pokémon-érték túl nagy.');
    const itemId=previous?.id || randomUUID();
    db.prepare(`INSERT INTO finance_pokemon_items(id,name,quantity,unit_price_minor,acquired_on,revision,updated_at) VALUES(?,?,?,?,?,1,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,quantity=excluded.quantity,unit_price_minor=excluded.unit_price_minor,acquired_on=excluded.acquired_on,revision=finance_pokemon_items.revision+1,updated_at=excluded.updated_at`).run(itemId,value.name,value.quantity,value.unit_price_minor,value.acquired_on,now);
    audit(db,itemId,actor,previous ? 'edit' : 'create',previous,db.prepare('SELECT * FROM finance_pokemon_items WHERE id=?').get(itemId),now);
    db.exec('COMMIT');return itemId;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function removePokemonCollection(db:DatabaseSync,data:FormData,actor:string,now=new Date().toISOString()) {
  const id=field(data,'id'),revision=field(data,'revision');if(field(data,'confirmed')!=='on' || !/^\d{1,9}$/.test(revision))throw new FinanceInputError('Erősítsd meg a Pokémon-tétel törlését.');
  db.exec('BEGIN IMMEDIATE');try{
    const previous=db.prepare('SELECT * FROM finance_pokemon_items WHERE id=? AND deleted_at IS NULL').get(id) as PokemonCollectionItem|undefined;
    if(!previous || Number(revision)!==previous.revision)throw new FinanceInputError('A Pokémon-tételt közben módosították vagy törölték. Frissítsd az oldalt.');
    db.prepare('UPDATE finance_pokemon_items SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?').run(now,now,id);
    audit(db,id,actor,'delete',previous,{deleted_at:now},now);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
// Explicit private input only: preserve separate purchase rows, including exact duplicates.
export function importPokemonCollection(db:DatabaseSync,input:unknown,actor:string,now=new Date().toISOString()):number {
  if(!Array.isArray(input) || !input.length || input.length>1000)throw new FinanceInputError('Érvénytelen Pokémon-import.');
  const values=input.map(row=>{
    if(!row || typeof row!=='object')throw new FinanceInputError('Érvénytelen Pokémon-importsor.');
    const form=new FormData();for(const key of ['name','quantity','unit_price','acquired_on']){if(typeof row[key]!=='string')throw new FinanceInputError('Az importmezők szövegesek legyenek.');form.set(key,row[key]);}return details(form);
  });
  const checksum=createHash('sha256').update(JSON.stringify(values)).digest('hex');
  db.exec('BEGIN IMMEDIATE');try{
    if(db.prepare('SELECT 1 FROM finance_pokemon_imports WHERE checksum=?').get(checksum)){db.exec('COMMIT');return 0;}
    if(db.prepare('SELECT 1 FROM finance_pokemon_items LIMIT 1').get())throw new FinanceInputError('Meglévő Pokémon-listát nem írhat felül az import; használd a szerkesztőt.');
    const total=values.reduce((n,value)=>n+value.quantity*value.unit_price_minor,0);if(!Number.isSafeInteger(total) || total>100_000_000_000_000)throw new FinanceInputError('Az összesített Pokémon-érték túl nagy.');
    for(const value of values){const id=randomUUID();db.prepare('INSERT INTO finance_pokemon_items(id,name,quantity,unit_price_minor,acquired_on,updated_at) VALUES(?,?,?,?,?,?)').run(id,value.name,value.quantity,value.unit_price_minor,value.acquired_on,now);audit(db,id,actor,'import',null,value,now);}
    db.prepare('INSERT INTO finance_pokemon_imports VALUES(?,?,?)').run(checksum,now,values.length);db.exec('COMMIT');return values.length;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
