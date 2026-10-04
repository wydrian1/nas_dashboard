import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import ts from 'typescript';
import { filterPokemonTitles } from '../app/pokemon-search.ts';
import { initializeDatabase } from '../lib/db-schema.ts';
import { readPokemonSnapshot } from '../lib/pokemon/snapshot.ts';
import type { PokemonSnapshot } from '../lib/pokemon/types.ts';

const require=createRequire(import.meta.url);
const products=[{title:'Pokémon Destined Rivals Booster'},{title:'Pokémon Prismatic Evolutions Box'},{title:'POKÉMON DESTINED RIVALS Tin'}];
test('name search is a case-insensitive literal substring with trimmed query',()=>{
  assert.deepEqual(filterPokemonTitles(products,'  destined RIVALS  '),[products[0],products[2]]);
  assert.deepEqual(filterPokemonTitles(products,'evolutions'),[products[1]]);
  assert.deepEqual(filterPokemonTitles(products,'not found'),[]);
  assert.deepEqual(filterPokemonTitles([{title:'Box [151] + Tin'}],'[151] +'),[{title:'Box [151] + Tin'}]);
});
test('empty/cleared search restores original order and never changes the source or searches other fields',()=>{
  const data=Object.freeze([{title:'Booster',url:'https://example.com/prismatic',sku:'PRISMATIC',shop_name:'Prismatic'}]);
  assert.deepEqual(filterPokemonTitles([...data],'prismatic'),[]);
  for(const query of ['','   '])assert.deepEqual(filterPokemonTitles(products,query),products);
  const before=JSON.stringify(products);filterPokemonTitles(products,'box');assert.equal(JSON.stringify(products),before);
});

function snapshot():PokemonSnapshot {
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    const data=readPokemonSnapshot(db,false);data.shops=data.shops.slice(0,2);
    data.shops.forEach((item,index)=>{
      const title=index ? 'Prismatic Evolutions Box' : 'Destined Rivals Booster';
      item.products=[{external_id:String(index),title,url:'https://example.com/product',sku:'',image:null,price_huf:1000,availability:'in_stock',in_stock:1,missing_count:0,episode:1,first_seen:1,last_seen:1,last_queued:null}];
      item.events=[{id:index+1,title,kind:index ? 'restock' : 'new',url:'https://example.com/product',price_huf:1000,occurred_at:1,mail_state:''}];
    });
    data.latestEvents=data.shops.flatMap(item=>item.events.map(event=>({...event,shop_id:item.shop.id,shop_name:item.shop.name,image:null})));
    return data;
  }finally{db.close();}
}
function panel(initial:PokemonSnapshot){
  // Render the real JSX with controlled hook state so input changes and polling
  // snapshots can be exercised without a browser or production API/database.
  const states:any[]=[initial,'','all','all',''];let cursor=0,change:((event:any)=>void)|undefined;
  const output=ts.transpileModule(readFileSync(new URL('../app/pokemon-panel.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:Record<string,any>={};new Function('require','exports',output)((name:string)=>{
    if(name==='react')return {...React,useEffect:()=>{},useState:()=>{const index=cursor++;return [states[index],(value:any)=>{states[index]=value;}];}};
    if(name==='react/jsx-runtime'){
      const runtime=require(name);return {...runtime,jsx:(type:any,props:any,key:any)=>{if(props.id==='pokemon-search')change=props.onChange;return runtime.jsx(type,props,key);}};
    }
    if(name==='./pokemon-search')return {filterPokemonTitles};
    if(name==='./pokemon-actions')return {};
    if(name==='./action-form')return {ActionForm:({children}:any)=>React.createElement('form',{},children),ActionButton:({children}:any)=>React.createElement('button',{},children)};
    throw new Error('Unexpected import '+name);
  },exports);
  return {render(){cursor=0;return load(renderToStaticMarkup(React.createElement(exports.default,{initial})));},search(value:string){assert.ok(change);change({target:{value}});},states};
}
test('one accessible client search filters aggregate, all shop products and all shop events; clearing restores them',()=>{
  const data=snapshot(),before=JSON.stringify(data),view=panel(data);let page=view.render();
  assert.equal(page('label[for="pokemon-search"]').text(),'Keresés terméknévben');assert.equal(page('#pokemon-search[type="search"]').length,1);
  assert.equal(page('.pokemon-latest-card').length,2);assert.equal(page('.pokemon-product').length,2);assert.equal(page('.pokemon-event').length,2);
  view.search('  DESTINED  ');page=view.render();
  for(const selector of ['.pokemon-latest-title','.pokemon-product a','.pokemon-event a']){assert.equal(page(selector).length,1);assert.match(page(selector).text(),/Destined Rivals/);}
  assert.equal(page('.pokemon-overview strong').first().text(),'1');assert.match(page('#shop-mythgames .pokemon-products summary').text(),/\(0\)/);assert.match(page('#shop-mythgames .pokemon-events summary').text(),/\(0\)/);
  assert.equal(page('.pokemon-panel').length,2);assert.equal(page('.pokemon-settings').length,2);assert.equal(JSON.stringify(data),before);
  view.search('');page=view.render();for(const selector of ['.pokemon-latest-card','.pokemon-product','.pokemon-event'])assert.equal(page(selector).length,2);
});
test('search composes with existing aggregate shop/kind filters without filtering shop controls',()=>{
  const view=panel(snapshot());view.render();view.search('box');view.states[2]='gamerunner';let page=view.render();
  assert.equal(page('.pokemon-latest-card').length,0);assert.equal(page('.pokemon-product').length,1);assert.equal(page('.pokemon-event').length,1);
  view.states[2]='all';view.states[3]='new';page=view.render();assert.equal(page('.pokemon-latest-card').length,0);
  view.states[3]='restock';page=view.render();assert.equal(page('.pokemon-latest-card').length,1);assert.equal(page('.pokemon-settings').length,2);
});
test('no-match messages and counts reflect search; reader retains search but no admin scan control',()=>{
  const data=snapshot();data.viewerRole='pokemon-reader';const view=panel(data);view.render();view.search('missing product');const page=view.render();
  for(const selector of ['.pokemon-latest-card','.pokemon-product','.pokemon-event'])assert.equal(page(selector).length,0);
  assert.equal(page('.pokemon-overview strong').first().text(),'0');assert.match(page('.pokemon-products').text(),/Nincs a keresésnek megfelelő elérhető termék/);
  assert.match(page('.pokemon-events').text(),/Nincs a keresésnek megfelelő esemény/);assert.equal(page('.pokemon-controls').length,0);assert.equal(page('#pokemon-search').val(),'missing product');
});
test('query survives refreshed data and newly arriving products are immediately filtered',()=>{
  const view=panel(snapshot());view.render();view.search('destined');
  const refreshed=snapshot();refreshed.shops[1].products[0].title='Destined Rivals Box';refreshed.shops[1].events[0].title='Destined Rivals Box';refreshed.latestEvents[1].title='Destined Rivals Box';view.states[0]=refreshed;
  const page=view.render();assert.equal(page('#pokemon-search').val(),'destined');for(const selector of ['.pokemon-latest-card','.pokemon-product','.pokemon-event'])assert.equal(page(selector).length,2);
});
