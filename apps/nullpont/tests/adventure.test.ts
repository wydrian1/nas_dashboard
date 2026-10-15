import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applyAction, applyCommand, availableActions, initialState, observeRoom, parseState, type GameState } from '../lib/game/engine.ts';
import { advanceGame, loadGame, resetGame } from '../lib/game/store.ts';
import { initializeDatabase } from '../lib/schema.ts';
import { CHAPTERS, createCatalog } from '../lib/game/catalog.ts';
import type { Chapter } from '../lib/game/types.ts';
import { gameView } from '../lib/game/view.ts';
import { readFileSync } from 'node:fs';

function escape(state: GameState) {
  if (state.focus?.length) state = applyCommand(state,{verb:'back',levels:state.focus.length});
  if (state.room === 'threshold') return state;
  if (!state.inventory.includes('foil') && !state.inventory.includes('bridge')) {
    state = applyAction(applyAction(state,'look:bed'),'look:rim');
    state = applyAction(state,'take:foil');
    state = applyCommand(state,{verb:'back',levels:2});
  }
  if (!state.inventory.includes('wire') && !state.inventory.includes('bridge')) {
    state = applyAction(applyAction(state,'look:panel'),'take:wire');
    state = applyCommand(state,{verb:'back'});
  }
  for (const id of ['combine:foil:wire','use:bridge:panel','move:threshold']) if (availableActions(state).some(action => action.id === id)) state = applyAction(state,id);
  return state;
}
test('opening puzzle supports discovery, taking, combining, use, movement and returning', () => {
  const opening = initialState();
  assert.match(opening.message, /7314/);
  assert.throws(() => applyAction(opening, 'take:foil'));
  assert.throws(() => applyAction(opening, 'combine:foil:wire'));
  let state = applyAction(applyAction(opening, 'look:room'), 'move:blocked');
  assert.equal(state.room, 'chamber');
  state = escape(state);
  assert.equal(state.room, 'threshold');
  assert.deepEqual(state.inventory, ['bridge']);
  assert.ok(state.flags.includes('door-open'));
  assert.match(state.message, /EGYETLEN SZEMÉLYZETI TAG/);
  state = applyAction(state, 'move:chamber');
  assert.ok(state.flags.includes('door-open'));
  assert.equal(applyAction(state, 'move:threshold').room, 'threshold');
  assert.deepEqual(opening, initialState(), 'rules do not mutate input');
});
test('NPC conversations, attacks and failed uses are safe and journal entries do not duplicate', () => {
  let state = applyAction(applyAction(initialState(), 'look:room'), 'talk:voice');
  state = applyAction(state, 'talk:identity');
  assert.match(state.message, /holnapi dátum/);
  state = applyAction(state, 'talk:help');
  assert.doesNotMatch(state.message, /Kösd össze|fólia|huzal|kombinál/);
  for (let index = 0; index < 20; index++) state = applyAction(state, 'attack:voice');
  assert.equal(new Set(state.journal).size, state.journal.length);
  state = applyAction(state, 'look:bed');
  state = applyAction(state, 'look:rim');
  state = applyAction(state, 'take:foil');
  state = applyCommand(state,{verb:'back',levels:2});
  const before = [...state.inventory];
  state = applyCommand(state, { verb: 'look', target: { kind: 'item', id: 'foil' } });
  assert.match(state.message, /hang hullámai/);
  state = applyAction(state, 'use:foil:panel');
  state = applyAction(state, 'use:foil:door');
  assert.deepEqual(state.inventory, before);
  assert.equal(escape(state).room, 'threshold');
});
test('every reachable opening state can escape: no death or soft lock', () => {
  const key = (state: GameState) => JSON.stringify([state.room, state.focus, [...state.inventory].sort(), [...state.flags].sort(), [...state.discoveries].sort()]);
  const seen = new Set<string>();
  const queue = [initialState()];
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];
    if (seen.has(key(state))) continue;
    seen.add(key(state));
    assert.equal(escape(state).room, 'threshold', `recoverable ${key(state)}`);
    assert.deepEqual(parseState(JSON.stringify(state)), state);
    for (const action of availableActions(state)) {
      const next = applyAction(state, action.id);
      if (['chamber','threshold'].includes(next.room) && !seen.has(key(next))) queue.push(next);
    }
    if (state.focus?.length) queue.push(applyCommand(state,{verb:'back'}));
    assert.ok(seen.size < 10000, 'bounded state graph');
  }
  assert.ok(seen.size > 30);
});
test('save validation rejects unsupported and damaged saves without resetting', () => {
  for (const value of [null, {}, { ...initialState(), version: 3 }, { ...initialState(), inventory: ['unknown'] }, { ...initialState(), inventory: ['constructor'] }, { ...initialState(), turns: -1 }, { ...initialState(), room: 'threshold' }, { ...initialState(), room: 'toString' }, { ...initialState(), book: [null] }, { ...initialState(), discoveries: ['future-secret'] }]) {
    assert.throws(() => parseState(JSON.stringify(value)));
  }
});
test('page and server action authenticate before reading saves and derive identity on the server', () => {
  const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const page = source('app/page.tsx'), action = source('app/actions.ts');
  assert.ok(page.indexOf('await requirePlayer()') < page.indexOf('gameView(loadGame('));
  assert.match(page, /if \(!player\) return/);
  assert.ok(action.indexOf('await requirePlayer()') < action.indexOf('const result = advanceGame('));
  assert.match(action, /advanceGame\(db\(\), player.email, revision, command\)/);
  assert.match(action, /play\(revision: number, command: PlayerCommand\)/);
});
test('story book writes narrative once at milestones, not after ordinary clicks, and preserves chronological history', () => {
  let state = initialState();
  assert.equal(state.book.length, 1);
  state = applyAction(state, 'look:room');
  assert.equal(state.book.length, 1);
  state = applyAction(state, 'talk:voice');
  state = applyAction(state, 'talk:voice');
  assert.equal(state.book.length, 2);
  state = applyAction(state, 'talk:identity');
  state = escape(state);
  assert.equal(state.book.length, 6);
  const book = structuredClone(state.book);
  state = applyAction(state, 'move:chamber');
  state = applyAction(state, 'use:bridge:panel');
  state = applyAction(state, 'move:threshold');
  assert.deepEqual(state.book, book);
  assert.ok(state.book.every((entry, index) => !index || entry.turn > state.book[index - 1].turn));
  assert.match(state.book.at(-1)!.text, /nagyobb rejtélybe/);
  assert.deepEqual(parseState(JSON.stringify(state)).book, book);
});
test('new chapters attach exits without editing the engine or invalidating existing saves and story pages', () => {
  const next: Chapter = { id: 'garden', title: 'II. A kert', items: {}, scenes: {
    'garden:entry': { title: 'A kert', description: 'Kert.', art: '[kert]', environment: [{ id: 'garden:tree', label: 'Fa' }], exits:[{id:'return',label:'Vissza'}], rules: [{ id: 'garden:look', label: 'Körülnézek', kind: 'look', interaction: { verb: 'look' }, discover: ['garden:tree'], message: 'Egy fa a kertben.' }, { id: 'garden:return', label: 'Vissza', kind: 'move', moveTo: 'threshold', interaction:{verb:'move',target:{kind:'exit',id:'return'}}, message: 'Visszatérsz.' }] },
  }, connections: [{ from: 'threshold', exits: [{ id: 'garden', label: 'A kert felé' }], artSpots:[{id:'garden:exit',exit:'garden',row:22,col:50,width:16,height:3,glyph:'[ >> ]'}], rules: [{ id: 'garden:enter', label: 'Belépek a kertbe', kind: 'move', moveTo: 'garden:entry', interaction: { verb: 'move', target: { kind: 'exit', id: 'garden' } }, message: 'Egy kert!', milestone: { id: 'garden:arrival', title: 'A kert', text: 'Egy elfeledett kertbe érkeztem. A történetem új irányt vett.' } }] }] };
  const catalog = createCatalog([...CHAPTERS, next]);
  const oldSave = escape(initialState());
  assert.deepEqual(parseState(JSON.stringify(oldSave), catalog), oldSave);
  assert.equal(availableActions(oldSave).some(action => action.id === 'garden:enter'), false, 'original catalog stays immutable');
  assert.ok(availableActions(oldSave, catalog).some(action => action.id === 'garden:enter'));
  assert.ok(catalog.scenes.threshold.exits!.some(exit => exit.id === 'garden'));
  assert.ok(gameView({state:oldSave,revision:0,updatedAt:'now'},catalog).scene.spots.some(spot=>spot.exit?.id==='garden'));
  let continued = applyCommand(oldSave, { verb: 'move', target: { kind: 'exit', id: 'garden' } }, catalog);
  assert.equal(continued.room, 'garden:entry');
  assert.deepEqual(continued.book.slice(0, -1), oldSave.book);
  assert.equal(continued.book.at(-1)!.chapter, next.title);
   assert.ok(continued.discoveries.includes('garden:tree'), 'arrival honors legacy generic exploration without an extra command');
  assert.ok(gameView({state:continued,revision:0,updatedAt:'now'},catalog).scene.spots.some(spot=>spot.environment==='garden:tree'),'legacy-compatible drawing contains discovered objects');
  continued = applyAction(continued, 'garden:return', catalog);
  assert.equal(continued.room, 'threshold');
  assert.deepEqual(parseState(JSON.stringify(continued), catalog), continued);
  assert.throws(() => createCatalog([...CHAPTERS, CHAPTERS[0]]));
  assert.throws(() => createCatalog([...CHAPTERS, { ...next, connections: [{ from: 'missing', rules: [] }] }]));
});
test('arrival and old-save reads reveal only baseline objects without inspection side effects or rewriting history',()=>{
  const initial=initialState();assert.deepEqual(initial.discoveries,['bed','panel','door','speaker']);assert.equal(initial.turns,0);assert.deepEqual(initial.flags,[]);assert.equal(initial.book.length,1);assert.equal(initial.journal.length,1);
  const old={...initial,discoveries:[],turns:7,message:'Korábbi üzenet.',journal:['Korábbi emlék.']};const bytes=JSON.stringify(old);
  const loaded=parseState(bytes);assert.deepEqual(loaded.discoveries,initial.discoveries);assert.deepEqual(loaded.book,old.book);assert.deepEqual(loaded.journal,old.journal);assert.equal(loaded.turns,7);assert.equal(loaded.message,old.message);assert.deepEqual(old.discoveries,[]);
  const database=new DatabaseSync(':memory:');try{initializeDatabase(database);loadGame(database,'legacy@example.test');database.prepare('UPDATE adventure_saves SET state_json=?,revision=12 WHERE owner=?').run(bytes,'legacy@example.test');const save=loadGame(database,'legacy@example.test');assert.equal(save.revision,12);assert.deepEqual(save.state.discoveries,initial.discoveries);assert.equal(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get('legacy@example.test')!.state_json,bytes);}finally{database.close();}
  const escaped=escape(initial);assert.ok(escaped.discoveries.includes('hall-window'));assert.ok(gameView({state:escaped,revision:1,updatedAt:'now'}).scene.spots.some(spot=>spot.environment==='hall-window'));
  const module=structuredClone(CHAPTERS[0]);const detail=module.scenes['awakening:bed-rim'];detail.environment!.find(entity=>entity.id==='loose-foil')!.requires={flags:['bed-seen']};const catalog=createCatalog([module]);assert.ok(!observeRoom({...initial,focus:['awakening:bed-detail','awakening:bed-rim']},catalog).discoveries.includes('loose-foil'));
  module.scenes.chamber.arrivalDiscoveries!.push('unknown');assert.throws(()=>createCatalog([module]),/érkezési/);
});
test('every opening examine action describes its target, while feedback avoids recipes and safety boilerplate',()=>{
  let state=initialState();const forbidden=/Nem fogyott el|nem sérült|nálad marad|Semmit nem veszített|Talán kombinálni|Kösd össze|Külön egyik sem elég/;
  for(const id of ['bed','panel','door','speaker']){const result=applyCommand(state,{verb:'look',target:{kind:'environment',id}});assert.ok(result.message.length>60);assert.doesNotMatch(result.message,/Nem történik|nem találsz rajta új részletet/);assert.doesNotMatch(result.message,forbidden);state=result;if(state.focus?.length)state=applyCommand(state,{verb:'back',levels:state.focus.length});}
  state=applyAction(applyAction(state,'look:bed'),'look:rim');let examined=applyCommand(state,{verb:'look',target:{kind:'environment',id:'loose-foil'}});assert.ok(examined.message.length>60);assert.doesNotMatch(examined.message,forbidden);state=applyAction(state,'take:foil');state=applyCommand(state,{verb:'back',levels:2});
  state=applyAction(state,'look:panel');examined=applyCommand(state,{verb:'look',target:{kind:'environment',id:'loose-wire'}});assert.ok(examined.message.length>60);assert.doesNotMatch(examined.message,forbidden);state=applyAction(state,'take:wire');state=applyCommand(state,{verb:'back'});
  for(const id of ['foil','wire']){const examined=applyCommand(state,{verb:'look',target:{kind:'item',id}});assert.ok(examined.message.length>60);assert.doesNotMatch(examined.message,forbidden);}
  for(const id of ['foil','wire']){const used=applyCommand(state,{verb:'use',item:id,target:{kind:'environment',id:'panel'}});assert.deepEqual(used.inventory,state.inventory);assert.doesNotMatch(used.message,forbidden);}
  state=applyAction(state,'combine:foil:wire');assert.ok(applyCommand(state,{verb:'look',target:{kind:'item',id:'bridge'}}).message.length>60);
  for(const scene of Object.values(CHAPTERS[0].scenes))for(const rule of scene.rules)assert.doesNotMatch(rule.message,forbidden);
});
test('confirmed restart resets only its owner, keeps revisions monotonic and rejects stale resets/actions',()=>{
  const database=new DatabaseSync(':memory:');try{
    initializeDatabase(database);const before=loadGame(database,'one@example.test');
    const played=advanceGame(database,'one@example.test',before.revision,{verb:'look'}).game;
    const other=loadGame(database,'other@example.test');
    const stale=resetGame(database,'one@example.test',before.revision);assert.equal(stale.conflict,true);assert.deepEqual(stale.game,played);
    const reset=resetGame(database,'ONE@example.test',played.revision);assert.equal(reset.conflict,false);assert.deepEqual(reset.game.state,initialState());assert.equal(reset.game.revision,played.revision+1);
    assert.equal(advanceGame(database,'one@example.test',played.revision,{verb:'look'}).conflict,true);
    assert.deepEqual(loadGame(database,'other@example.test'),other);assert.deepEqual(loadGame(database,'one@example.test'),reset.game);
    assert.throws(()=>resetGame(database,'one@example.test',-1));
    const action=readFileSync(new URL('../app/actions.ts',import.meta.url),'utf8');assert.match(action,/confirmed !== true/);assert.ok(action.indexOf('await requirePlayer()',action.indexOf('export async function restart'))<action.indexOf('resetGame(db()'));
  }finally{database.close();}
});
test('ASCII scene shows every discovered actionable element and exit, without leaking hidden objects',()=>{
   let state=initialState();let view=gameView({state,revision:0,updatedAt:'now'});assert.equal(view.scene.spots.length,4);assert.ok(view.scene.columns>=75);assert.ok(view.scene.rows>=26);
  state=applyAction(state,'look:room');view=gameView({state,revision:1,updatedAt:'now'});
  assert.equal(view.scene.spots.length,4);assert.ok(view.scene.spots.some(spot=>spot.exit?.id==='door'));assert.ok(!JSON.stringify(view).includes('loose-foil'));
  state=applyAction(state,'look:bed');view=gameView({state,revision:2,updatedAt:'now'});assert.ok(!view.scene.spots.some(spot=>spot.environment==='loose-foil'));state=applyAction(state,'look:rim');view=gameView({state,revision:2,updatedAt:'now'});assert.ok(view.scene.spots.some(spot=>spot.environment==='loose-foil'&&spot.glyph));
  state=applyAction(state,'take:foil');view=gameView({state,revision:3,updatedAt:'now'});assert.ok(!view.scene.spots.some(spot=>spot.id==='loose-foil'));assert.ok(view.inventory[0].art.includes('------'));
  for(const chapter of CHAPTERS)for(const scene of Object.values(chapter.scenes)){
    for(const entity of scene.environment??[])assert.ok(scene.artSpots!.some(spot=>spot.environment===entity.id));
    for(const exit of scene.exits??[])assert.ok(scene.artSpots!.some(spot=>spot.exit===exit.id));
  }
  const invalid=structuredClone(CHAPTERS[0]);invalid.scenes.chamber.artSpots![0].row=-1;assert.throws(()=>createCatalog([invalid]),/ASCII/);
  const incomplete=structuredClone(CHAPTERS[0]);incomplete.scenes.chamber.artSpots!.pop();assert.throws(()=>createCatalog([incomplete]),/Hiányzó/);
});
test('database initializes idempotently, isolates normalized accounts and reloads exact progress', () => {
  const database = new DatabaseSync(':memory:');
  try {
    initializeDatabase(database); initializeDatabase(database);
    const first = loadGame(database, ' One@Example.test ');
    assert.equal(first.revision, 0);
    const saved = advanceGame(database, 'one@example.test', 0, { verb: 'look' });
    assert.equal(saved.conflict, false);
    assert.deepEqual(loadGame(database, 'ONE@example.test'), saved.game);
    assert.deepEqual(loadGame(database, 'other@example.test').state, initialState());
    const conflict = advanceGame(database, 'one@example.test', 0, { verb: 'look', target: { kind: 'environment', id: 'panel' } });
    assert.equal(conflict.conflict, true);
    assert.deepEqual(conflict.game, saved.game);
    assert.throws(() => advanceGame(database, 'one@example.test', 1, { verb: 'take', target: { kind: 'environment', id: 'loose-wire' } }));
    assert.throws(() => advanceGame(database, 'one@example.test', -1, { verb: 'look' }));
    assert.deepEqual(loadGame(database, 'one@example.test'), saved.game);
    database.prepare('UPDATE adventure_saves SET state_json=? WHERE owner=?').run('{"version":99}', 'one@example.test');
    assert.throws(() => loadGame(database, 'one@example.test'));
    assert.equal(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get('one@example.test')!.state_json, '{"version":99}');
  } finally { database.close(); }
});
test('environment grows through exploration, hidden targets cannot be forged and views contain no solution rules', () => {
  let state = initialState();
  const view = () => gameView({ state, revision: 0, updatedAt: 'now' });
  assert.equal(view().environment.length, 4); assert.equal(view().exits.length, 1);
  assert.throws(() => applyCommand(state, { verb: 'take', target: { kind: 'environment', id: 'loose-foil' } }));
  state = applyCommand(state, { verb: 'look' });
  assert.equal(view().environment.length, 4);
  assert.ok(!JSON.stringify(view()).includes('combine:foil:wire'));
  state = applyCommand(state, { verb: 'look', target: { kind: 'environment', id: 'bed' } });
  assert.ok(!view().environment.some(entry => entry.id === 'loose-foil'));
  assert.throws(()=>applyCommand(state,{verb:'look',target:{kind:'environment',id:'panel'}}));
  state = applyAction(state,'look:rim');
  assert.ok(view().environment.some(entry => entry.id === 'loose-foil'));
  state = applyCommand(state, { verb: 'take', target: { kind: 'environment', id: 'loose-foil' } });
  assert.ok(!view().environment.some(entry => entry.id === 'loose-foil'));
  state = applyCommand(state,{verb:'back',levels:2});
  const before = [...state.inventory];
  state = applyCommand(state, { verb: 'use', item: 'foil', target: { kind: 'environment', id: 'speaker' } });
  assert.deepEqual(state.inventory, before); assert.match(state.message, /Nem történik/);
  state = applyAction(state, 'look:panel'); state = applyAction(state, 'take:wire');state=applyCommand(state,{verb:'back'});
  state = applyCommand(state, { verb: 'combine', item: 'wire', target: { kind: 'item', id: 'foil' } });
  assert.deepEqual(state.inventory, ['bridge']);
});
test('version-one saves migrate without changing progress, revision-independent history or narrative pages', () => {
  const state = escape(initialState());
  const { discoveries, ...old } = state;
  const migrated = parseState(JSON.stringify({ ...old, version: 1 }));
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.book, state.book); assert.deepEqual(migrated.inventory, state.inventory);
  assert.deepEqual(migrated.journal, state.journal); assert.equal(migrated.message, state.message); assert.equal(migrated.turns, state.turns);
  assert.ok(migrated.discoveries.includes('hall-window'));
});
test('identity milestone distinguishes testimony from chronology without rewriting previously saved pages', () => {
  let state = applyAction(initialState(), 'look:room');
  state = applyAction(state, 'talk:voice');
  state = applyAction(state, 'talk:identity');
  const entry = state.book.find(page => page.id === 'awakening:identity')!;
  assert.match(entry.text, /Azt is állította/);
  assert.match(entry.text, /nem láttam a kérelmet/);
  assert.doesNotMatch(entry.text, /Valaki előbb teljesítette|a kérelmet holnapra dátumoztam/);
  assert.match(state.journal.at(-1)!, /Szerinte/);
  const historical = 'Valaki előbb teljesítette, mint hogy megírhattam volna.';
  entry.text = historical;
  const saved = parseState(JSON.stringify(state));
  const continued = applyAction(saved, 'talk:identity');
  assert.equal(continued.book.find(page => page.id === 'awakening:identity')!.text, historical);
  assert.equal(continued.book.length, saved.book.length);
});
