import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../lib/game/catalog.ts';
import { activeSceneId, applyAction, applyCommand, observeRoom, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import type { Chapter, GameState, PlayerCommand } from '../lib/game/types.ts';

function fixture(): Chapter {
  return { id: 'test', title: 'Test', items: { token: 'Token' }, scenes: {
    room: { title: 'Room', description: 'Room.', art: '[box] [keypad]', arrivalDiscoveries: ['box','keypad'], environment: [{id:'box',label:'Box'},{id:'keypad',label:'Keypad'}], artSpots: [{id:'box',environment:'box',row:0,col:0,width:5,height:1},{id:'keypad',environment:'keypad',row:0,col:6,width:8,height:1}], inputs: [{id:'keypad',label:'Code',prompt:'Enter code',format:'digits',maxLength:3}], rules: [
      {id:'inspect',label:'Inspect',kind:'look',interaction:{verb:'look',target:{kind:'environment',id:'box'}},focusTo:'detail',message:'Detail.'},
      {id:'unlock',label:'Submit',kind:'submit',interaction:{verb:'submit',target:{kind:'environment',id:'keypad'},input:'314'},addFlags:['unlocked'],removeFlags:['locked'],message:'Open.'},
    ] },
    detail: {detailOf:'room',title:'Detail',description:'Detail.',art:'[rim]',arrivalDiscoveries:['rim'],environment:[{id:'rim',label:'Rim'}],artSpots:[{id:'rim',environment:'rim',row:0,col:0,width:5,height:1}],rules:[{id:'inspect-rim',label:'Inspect',kind:'look',interaction:{verb:'look',target:{kind:'environment',id:'rim'}},focusTo:'inner',message:'Inner.'}]},
    inner: {detailOf:'detail',title:'Inner',description:'Inner.',art:'[token] [exit]',arrivalDiscoveries:['loose-token'],environment:[{id:'loose-token',label:'Token',requires:{withoutItems:['token']}}],exits:[{id:'return',label:'Return'}],artSpots:[{id:'token',environment:'loose-token',row:0,col:0,width:7,height:1},{id:'return',exit:'return',row:0,col:8,width:6,height:1}],rules:[{id:'take',label:'Take',kind:'take',interaction:{verb:'take',target:{kind:'environment',id:'loose-token'}},requires:{withoutItems:['token']},addItems:['token'],message:'Taken.'},{id:'return',label:'Return',kind:'move',interaction:{verb:'move',target:{kind:'exit',id:'return'}},moveTo:'room',message:'Room.'}]},
    elsewhere:{title:'Elsewhere',description:'Elsewhere.',art:'[]',rules:[]},
  }};
}
const start = (): GameState => ({version:2,room:'room',inventory:[],flags:[],discoveries:[],journal:['old'],book:[],message:'old',turns:7});
const look = (id:string): PlayerCommand => ({verb:'look',target:{kind:'environment',id}});
test('nested focus preserves physical room, history, discoveries, view isolation and reload orientation',()=>{
  const catalog=createCatalog([fixture()]);const original=observeRoom(start(),catalog);
  assert.equal(original.focus,undefined);
  let state=applyCommand(original,look('box'),catalog);
  assert.equal(state.room,'room');assert.deepEqual(state.focus,['detail']);assert.equal(activeSceneId(state),'detail');
  assert.throws(()=>applyCommand(state,look('keypad'),catalog));
  let view=gameView({state,revision:12,updatedAt:'now'},catalog);
  assert.deepEqual(view.environment.map(entry=>entry.id),['rim']);assert.deepEqual(view.inputs,[]);
  state=applyCommand(state,look('rim'),catalog);assert.deepEqual(state.focus,['detail','inner']);
  assert.deepEqual(parseState(JSON.stringify(state),catalog),state);
  view=gameView({state,revision:12,updatedAt:'now'},catalog);assert.deepEqual(view.breadcrumbs.map(entry=>entry.id),['room','detail','inner']);assert.equal(view.revision,12);
  state=applyCommand(state,{verb:'take',target:{kind:'environment',id:'loose-token'}},catalog);assert.deepEqual(state.inventory,['token']);
  state=applyCommand(state,{verb:'back'},catalog);assert.equal(activeSceneId(state),'detail');
  state=applyCommand(state,{verb:'back'},catalog);assert.equal(state.focus,undefined);assert.deepEqual(state.journal,original.journal);assert.deepEqual(state.book,original.book);
  const inner=applyCommand(applyCommand(original,look('box'),catalog),look('rim'),catalog);
  assert.equal(applyCommand(inner,{verb:'back',levels:2},catalog).focus,undefined);
  assert.equal(applyCommand(inner,{verb:'move',target:{kind:'exit',id:'return'}},catalog).focus,undefined);
  for(const command of [{verb:'back',levels:3},{verb:'back',levels:0},{verb:'back',levels:33},{verb:'back',target:{kind:'environment',id:'box'}}])assert.throws(()=>applyCommand(inner,command as PlayerCommand,catalog));
  assert.deepEqual(original,observeRoom(start(),catalog),'input is immutable');
});
test('malformed, orphan, cross-room, cyclic and gated saved focus rejects without resets',()=>{
  const catalog=createCatalog([fixture()]);
  for(const focus of [null,'detail',['missing'],['inner'],['elsewhere'],['detail','detail'],['detail','inner','detail'],Array(33).fill('detail')])assert.throws(()=>parseState(JSON.stringify({...start(),focus}),catalog));
  assert.throws(()=>parseState(JSON.stringify({...start(),room:'detail'}),catalog));
  const chapter=fixture();chapter.scenes.detail.requires={flags:['allowed']};chapter.scenes.room.rules[0].addFlags=['allowed'];const gated=createCatalog([chapter]);
  assert.throws(()=>parseState(JSON.stringify({...start(),focus:['detail']}),gated));
  assert.equal(parseState(JSON.stringify({...start(),focus:['detail'],flags:['allowed']}),gated).room,'room');
  assert.equal(parseState(JSON.stringify(start()),catalog).focus,undefined);
});
test('catalog rejects bad detail links, missing art, unknown focus targets and invalid input declarations',()=>{
  const mutations=[(c:Chapter)=>{c.scenes.detail.detailOf='missing';},(c:Chapter)=>{c.scenes.room.detailOf='inner';},(c:Chapter)=>{c.scenes.detail.artSpots=[];},(c:Chapter)=>{delete c.scenes.room.rules[0].focusTo;},(c:Chapter)=>{c.scenes.room.rules[0].focusTo='inner';},(c:Chapter)=>{c.scenes.room.rules[0].focusTo='missing';},(c:Chapter)=>{c.scenes.room.inputs![0].maxLength=257;},(c:Chapter)=>{c.scenes.room.inputs![0].id='missing';},(c:Chapter)=>{c.scenes.room.rules[1].interaction!.input='3144';}];
  for(const mutate of mutations){const chapter=fixture();mutate(chapter);assert.throws(()=>createCatalog([chapter]));}
});
test('input view exposes only public constraints and correct exact trimmed input executes server effects',()=>{
  const catalog=createCatalog([fixture()]),state=observeRoom(start(),catalog);
  const view=gameView({state,revision:3,updatedAt:'now'},catalog);
  assert.deepEqual(view.inputs,[{id:'keypad',label:'Code',prompt:'Enter code',format:'digits',maxLength:3}]);assert.ok(!JSON.stringify(view).includes('314'));assert.ok(!JSON.stringify(view).includes('unlocked'));
  const submit=(input:string)=>applyCommand(state,{verb:'submit',target:{kind:'environment',id:'keypad'},input},catalog);
  for(const input of ['','abc','31','315','3144','3\n14']){const result=submit(input);assert.deepEqual(result.flags,state.flags);assert.deepEqual(result.inventory,state.inventory);assert.equal(result.turns,state.turns);assert.deepEqual(result.book,state.book);}
  assert.ok(submit(' 314 ').flags.includes('unlocked'));assert.equal(submit('314').turns,state.turns+1);
  const switched=applyCommand({...state,flags:['locked']},{verb:'submit',target:{kind:'environment',id:'keypad'},input:'314'},catalog);assert.deepEqual(switched.flags,['unlocked']);assert.deepEqual(parseState(JSON.stringify(switched),catalog).flags,['unlocked']);
  assert.throws(()=>submit('1'.repeat(257)));assert.throws(()=>applyAction(state,'unlock',catalog));
  for(const command of [{verb:'submit',target:{kind:'environment',id:'box'},input:'314'},{verb:'submit',target:{kind:'environment',id:'keypad'},input:314},{verb:'look',input:'314'},{verb:'submit',input:'314'}])assert.throws(()=>applyCommand(state,command as PlayerCommand,catalog));
});
