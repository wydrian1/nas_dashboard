import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initializeFinance } from '../lib/finance/schema.ts';
import { readPokemonCollection, savePokemonCollection, removePokemonCollection, importPokemonCollection } from '../lib/finance/pokemon-collection.ts';
import { readLego, importLego } from '../lib/finance/lego.ts';
import { collectionGrowth } from '../lib/finance/collection-growth-types.ts';
import type { InflationSeries } from '../lib/finance/inflation-types.ts';

const row={name:'Demo box',quantity:'2',unit_price:'12 345',acquired_on:'2026-01-12'};
function data(overrides:Record<string,string>={}){const form=new FormData();for(const [key,value]of Object.entries({id:'',revision:'0',...row,...overrides}))form.set(key,value);return form;}
function fixture(){const db=new DatabaseSync(':memory:');initializeFinance(db);importLego(db,[{set_number:'12345',name:'LEGO demo',quantity:'1',unit_price:'50.25',acquired_on:''}],'test');db.exec("INSERT INTO finance_accounts VALUES('asset','Demo','Test','asset',1,NULL);INSERT INTO finance_months(month,as_of,source,updated_at) VALUES('2026-01','2026-01-31','manual','2026-01-31');INSERT INTO finance_balances VALUES('2026-01','asset',12300,0,NULL)");return db;}
test('Pokemon purchase CRUD normalizes whole prices, preserves duplicates and leaves LEGO/monthly records unchanged',()=>{
  const db=fixture();try{
    const lego=JSON.stringify(readLego(db));const id=savePokemonCollection(db,data(),'owner','2026-02-01');savePokemonCollection(db,data(),'owner');
    assert.equal(readPokemonCollection(db).items.length,2);assert.equal(readPokemonCollection(db).totalMinor,4938000);assert.equal(Object.getPrototypeOf(readPokemonCollection(db).items[0]),Object.prototype);
    const edit=data({id,revision:'1',unit_price:'1.234,567',acquired_on:''});savePokemonCollection(db,edit,'owner');assert.throws(()=>savePokemonCollection(db,edit,'owner'),/közben/);
    const updated=readPokemonCollection(db).items.find(item=>item.id===id)!;assert.equal(updated.unit_price_minor,123456700);assert.equal(updated.acquired_on,null);
    assert.equal(JSON.stringify(readLego(db)),lego);assert.equal(db.prepare('SELECT amount_minor FROM finance_balances').get()!.amount_minor,12300);assert.equal(db.prepare('SELECT count(*) n FROM finance_audit').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM finance_pokemon_audit').get()!.n,3);
  }finally{db.close();}
});
test('Pokemon delete requires confirmation/version, retains audit and cannot resurrect stale records',()=>{
  const db=fixture();try{const id=savePokemonCollection(db,data(),'owner'),remove=data({id,revision:'1',confirmed:'off'});assert.throws(()=>removePokemonCollection(db,remove,'owner'));remove.set('confirmed','on');removePokemonCollection(db,remove,'owner');assert.equal(readPokemonCollection(db).items.length,0);assert.throws(()=>removePokemonCollection(db,remove,'owner'));assert.throws(()=>savePokemonCollection(db,data({id,revision:'1'}),'owner'));assert.equal(db.prepare('SELECT count(*) n FROM finance_pokemon_items').get()!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM finance_pokemon_audit').get()!.n,2);}finally{db.close();}
});
test('private Pokemon import is atomic, repeat-safe, row-preserving and never overwrites edits or resurrects deleted rows',()=>{
  const db=fixture();try{assert.throws(()=>importPokemonCollection(db,[row,{...row,quantity:'0'}],'owner'));assert.equal(readPokemonCollection(db).items.length,0);assert.equal(importPokemonCollection(db,[row,row],'owner'),2);assert.equal(readPokemonCollection(db).quantity,4);const item=readPokemonCollection(db).items[0];removePokemonCollection(db,data({id:item.id,revision:'1',confirmed:'on'}),'owner');assert.equal(importPokemonCollection(db,[row,row],'owner'),0);assert.equal(readPokemonCollection(db).items.length,1);assert.throws(()=>importPokemonCollection(db,[{...row,name:'Different'}],'owner'));assert.equal(readLego(db).totalMinor,5025);}finally{db.close();}
});
test('Pokemon validation rejects forged/missing/duplicate/negative/overflow/date/version inputs without mutation',()=>{
  const invalid:Record<string,string>[]=[{name:''},{name:'x'.repeat(201)},{quantity:'1.5'},{quantity:'0'},{quantity:'10000'},{unit_price:'-1'},{unit_price:'abc'},{unit_price:''},{unit_price:'1000000001'},{acquired_on:'2026-02-30'},{revision:'-1'},{id:'missing',revision:'1'}];
  const db=fixture();try{for(const change of invalid)assert.throws(()=>savePokemonCollection(db,data(change),'owner'));
    const duplicate=data();duplicate.append('name','Other');assert.throws(()=>savePokemonCollection(db,duplicate,'owner'));duplicate.delete('name');assert.throws(()=>savePokemonCollection(db,duplicate,'owner'));assert.equal(readPokemonCollection(db).items.length,0);assert.equal(db.prepare('SELECT count(*) n FROM finance_pokemon_audit').get()!.n,0);
  }finally{db.close();}
});
const inflation:InflationSeries={annual:[{year:2025,rate:.5}],monthly:[{month:'2026-02',yoy:.9,mom:.1},{month:'2026-03',yoy:.8,mom:.2}],fetchedAt:'2026-04-01'};
test('collection growth compounds purchase-specific monthly CPI, not annual/YoY; sums quantity and uses saved zero correctly',()=>{
  const items=[{quantity:2,unit_price_minor:10000,acquired_on:'2026-01-12'},{quantity:1,unit_price_minor:10000,acquired_on:'2026-02-12'}];
  const growth=collectionGrowth(items,50000,'2026-03-31',inflation);assert.equal(growth.costMinor,30000);assert.equal(growth.adjustedCostMinor,38400);assert.equal(growth.nominalGainMinor,20000);assert.equal(growth.realGainMinor,11600);assert.equal(growth.quantity,3);assert.ok(Math.abs(growth.realRatio!-11600/38400)<1e-12);
  assert.equal(collectionGrowth(items,0,'2026-03-31',inflation).nominalGainMinor,-30000);assert.equal(collectionGrowth(items,null,'2026-03-31',inflation).nominalGainMinor,null);
});
test('collection growth excludes later purchases, reports unknown dates/missing CPI and never invents old collection value',()=>{
  const item={quantity:1,unit_price_minor:10000,acquired_on:'2026-01-12'};
  const future=collectionGrowth([item,{...item,acquired_on:'2026-04-01'}],20000,'2026-03-31',inflation);assert.equal(future.costMinor,10000);assert.equal(future.futureItems,1);
  const unknown=collectionGrowth([item,{...item,acquired_on:null}],20000,'2026-03-31',inflation);assert.equal(unknown.nominalGainMinor,0);assert.equal(unknown.unknownDates,1);assert.equal(unknown.realGainMinor,null);assert.match(unknown.realUnavailable!,/dátum/);
  for(const series of [undefined,{...inflation,monthly:inflation.monthly.slice(1)},{...inflation,monthly:[{...inflation.monthly[0],mom:null},inflation.monthly[1]]},{...inflation,monthly:[{...inflation.monthly[0],mom:NaN},inflation.monthly[1]]}]){const missing=collectionGrowth([item],20000,'2026-03-31',series);assert.equal(missing.realGainMinor,null);assert.match(missing.realUnavailable!,/Hiányos KSH/);}
  const empty=collectionGrowth([],10000,'2026-03-31',inflation);assert.equal(empty.nominalGainMinor,null);assert.equal(empty.realGainMinor,null);
  const same=collectionGrowth([item],20000,'2026-01-12');assert.equal(same.realGainMinor,10000);
  const free=collectionGrowth([{...item,unit_price_minor:0}],10000,'2026-03-31');assert.equal(free.nominalRatio,null);assert.equal(free.realRatio,null);
});
test('collection real gain handles deflation, zero denominators and duplicate index ambiguity safely',()=>{
  const item={quantity:1,unit_price_minor:10000,acquired_on:'2026-01-01'};
  const deflation={...inflation,monthly:[{month:'2026-02',yoy:0,mom:-.1}]};assert.equal(collectionGrowth([item],10000,'2026-02-28',deflation).realGainMinor,1000);
  assert.equal(collectionGrowth([item],10000,'2026-03-31',{...inflation,monthly:[...inflation.monthly,inflation.monthly[0]]}).realGainMinor,null);
});
