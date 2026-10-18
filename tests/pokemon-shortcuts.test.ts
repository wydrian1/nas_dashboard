import test from 'node:test';
import assert from 'node:assert/strict';
import {pokemonShortcutNeedsAttention} from '../app/pokemon-shortcuts.ts';

const fresh={stale:false,reason:'Frissen ellenőrzött állapot.',checkedAt:1000};
const stale={...fresh,stale:true,reason:'Az utolsó ellenőrzés nem sikerült.'};
const shop={enabled:1,status:'ok',failure_count:0,last_success:1000};
test('Pokémon shortcuts flag every failure category, pending confirmation, stale stock and missing worker',()=>{
  for(const status of ['error','maintenance','protected','rate_limited','warning']){
    assert.equal(pokemonShortcutNeedsAttention({...shop,status},fresh,true),true,status);
    assert.equal(pokemonShortcutNeedsAttention({...shop,status,last_success:null},undefined,true),true,status+' before baseline');
  }
  assert.equal(pokemonShortcutNeedsAttention(shop,stale,true),true);
  assert.equal(pokemonShortcutNeedsAttention(shop,fresh,false),true);
  assert.equal(pokemonShortcutNeedsAttention({...shop,last_success:null},stale,false),true);
  assert.equal(pokemonShortcutNeedsAttention({...shop,status:'scanning',failure_count:1},fresh,true),true);
});
test('Pokémon shortcuts leave paused/new/waiting/healthy scans normal and clear after recovery',()=>{
  for(const status of ['ok','idle','scanning']){
    assert.equal(pokemonShortcutNeedsAttention({...shop,status},fresh,true),false,status);
    assert.equal(pokemonShortcutNeedsAttention({...shop,status,last_success:null},stale,true),false,status+' pending first scan');
  }
  assert.equal(pokemonShortcutNeedsAttention(shop,undefined,true),false);
  assert.equal(pokemonShortcutNeedsAttention({...shop,enabled:0,status:'error',failure_count:4},stale,false),false);
  assert.equal(pokemonShortcutNeedsAttention({...shop,status:'paused',failure_count:4},stale,false),false);
  assert.equal(pokemonShortcutNeedsAttention({...shop,status:'scanning',failure_count:2},stale,true),true);
  assert.equal(pokemonShortcutNeedsAttention(shop,fresh,true),false);
});
