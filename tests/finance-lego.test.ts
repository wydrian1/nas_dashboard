import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initializeFinance } from '../lib/finance/schema.ts';
import { readLego, saveLego, removeLego, importLego } from '../lib/finance/lego.ts';
const row={set_number:'12345',name:'Kastély',quantity:'2',unit_price:'12 345,67',acquired_on:''};
function data(overrides:Record<string,string>={}){const form=new FormData();for(const [key,value] of Object.entries({id:'',revision:'0',...row,...overrides}))form.set(key,value);return form;}
function fixture(){const db=new DatabaseSync(':memory:');initializeFinance(db);db.exec("INSERT INTO finance_accounts VALUES('lego','LEGO','Gyűjtemény','asset',1,NULL); INSERT INTO finance_months(month,as_of,source,updated_at) VALUES('2026-09','2026-09-01','manual','2026-09-01'); INSERT INTO finance_balances VALUES('2026-09','lego',12300,0,NULL);");return db;}
test('LEGO quantity x unit price is integer Ft; unknown date is absent and history stays untouched',()=>{
  const db=fixture();try{const id=saveLego(db,data(),'admin'),snapshot=readLego(db);assert.equal(snapshot.totalMinor,2469134);assert.equal(snapshot.quantity,2);assert.equal(snapshot.items[0].acquired_on,null);assert.equal(Object.getPrototypeOf(snapshot.items[0]),Object.prototype);
    const edit=data({id,revision:'1',quantity:'3',acquired_on:'2026-01-02'});saveLego(db,edit,'admin');assert.equal(readLego(db).totalMinor,3703701);assert.throws(()=>saveLego(db,edit,'admin'),/közben/);
    assert.equal(db.prepare('SELECT amount_minor FROM finance_balances').get()!.amount_minor,12300);assert.equal(db.prepare('SELECT count(*) AS n FROM finance_audit').get()!.n,0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM finance_lego_audit').get()!.n,2);
  }finally{db.close();}
});
test('LEGO deletes are confirmed, stale-safe and retain private audit without erasing historical balances',()=>{
  const db=fixture();try{const id=saveLego(db,data(),'admin'),remove=data({id,revision:'1',confirmed:'off'});assert.throws(()=>removeLego(db,remove,'admin'));remove.set('confirmed','on');removeLego(db,remove,'admin');assert.equal(readLego(db).totalMinor,0);assert.equal(readLego(db).items.length,0);assert.throws(()=>removeLego(db,remove,'admin'));assert.throws(()=>saveLego(db,data({id,revision:'1'}),'admin'));
    assert.equal(db.prepare('SELECT count(*) AS n FROM finance_lego_items').get()!.n,1);assert.equal(db.prepare('SELECT count(*) AS n FROM finance_lego_audit').get()!.n,2);
  }finally{db.close();}
});
test('LEGO import is validated, atomic, repeat-safe and does not resurrect deleted or overwrite edited items',()=>{
  const db=fixture();try{assert.throws(()=>importLego(db,[row,{...row,quantity:'0'}],'admin'));assert.equal(readLego(db).items.length,0);assert.equal(importLego(db,[row],'admin'),1);const item=readLego(db).items[0];removeLego(db,data({id:item.id,revision:'1',confirmed:'on'}),'admin');assert.equal(importLego(db,[row],'admin'),0);assert.equal(readLego(db).items.length,0);assert.throws(()=>importLego(db,[{...row,name:'Other'}],'admin'));}finally{db.close();}
});
test('LEGO rejects invalid, missing, duplicate, negative, overflowing and impossible-date inputs without mutation',()=>{
  const invalid:Record<string,string>[]=[{quantity:'0'},{quantity:'1.5'},{quantity:'10000'},{unit_price:'-1'},{unit_price:''},{unit_price:'1000000001'},{set_number:'bad'},{name:''},{acquired_on:'2026-02-30'},{id:'missing',revision:'1'}];
  const db=fixture();try{for(const change of invalid)assert.throws(()=>saveLego(db,data(change),'admin'));
    const form=data();form.append('unit_price','1');assert.throws(()=>saveLego(db,form,'admin'));form.delete('unit_price');assert.throws(()=>saveLego(db,form,'admin'));assert.equal(readLego(db).items.length,0);assert.equal(db.prepare('SELECT count(*) AS n FROM finance_lego_audit').get()!.n,0);
  }finally{db.close();}
});
