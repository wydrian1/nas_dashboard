import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applyAction, availableActions, initialState, parseState, type GameState } from '../lib/adventure/engine.ts';
import { advanceGame, loadGame } from '../lib/adventure/store.ts';
import { initializeDatabase } from '../lib/db-schema.ts';
import { CHAPTERS, createCatalog } from '../lib/adventure/catalog.ts';
import type { Chapter } from '../lib/adventure/types.ts';
import { readFileSync } from 'node:fs';

function escape(state: GameState) {
  for (const id of ['look:bed', 'look:panel', 'take:foil', 'take:wire', 'combine:foil:wire', 'use:bridge:panel', 'move:threshold']) {
    if (state.room === 'threshold') break;
    if (availableActions(state).some(action => action.id === id)) state = applyAction(state, id);
  }
  return state;
}
test('opening puzzle supports discovery, taking, combining, use, movement and returning', () => {
  const opening = initialState();
  assert.match(opening.message, /7314/);
  assert.throws(() => applyAction(opening, 'take:foil'));
  assert.throws(() => applyAction(opening, 'combine:foil:wire'));
  let state = applyAction(opening, 'move:blocked');
  assert.equal(state.room, 'chamber');
  state = escape(state);
  assert.equal(state.room, 'threshold');
  assert.deepEqual(state.inventory, ['bridge']);
  assert.ok(state.flags.includes('door-open'));
  assert.match(state.message, /folytatás még készül/);
  state = applyAction(state, 'move:chamber');
  assert.ok(state.flags.includes('door-open'));
  assert.equal(applyAction(state, 'move:threshold').room, 'threshold');
  assert.deepEqual(opening, initialState(), 'rules do not mutate input');
});
test('NPC conversations, attacks and failed uses are safe and journal entries do not duplicate', () => {
  let state = applyAction(initialState(), 'talk:voice');
  state = applyAction(state, 'talk:identity');
  assert.match(state.message, /holnapi dátum/);
  state = applyAction(state, 'talk:help');
  assert.match(state.message, /fólia/);
  for (let index = 0; index < 20; index++) state = applyAction(state, 'attack:voice');
  assert.equal(new Set(state.journal).size, state.journal.length);
  state = applyAction(state, 'look:bed');
  state = applyAction(state, 'take:foil');
  const before = [...state.inventory];
  state = applyAction(state, 'use:foil:panel');
  state = applyAction(state, 'use:foil:door');
  assert.deepEqual(state.inventory, before);
  assert.equal(escape(state).room, 'threshold');
});
test('every reachable opening state can escape: no death or soft lock', () => {
  const key = (state: GameState) => JSON.stringify([state.room, [...state.inventory].sort(), [...state.flags].sort()]);
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
      if (!seen.has(key(next))) queue.push(next);
    }
    assert.ok(seen.size < 1000, 'bounded state graph');
  }
  assert.ok(seen.size > 30);
});
test('save validation rejects unsupported and damaged saves without resetting', () => {
  for (const value of [null, {}, { ...initialState(), version: 2 }, { ...initialState(), inventory: ['unknown'] }, { ...initialState(), inventory: ['constructor'] }, { ...initialState(), turns: -1 }, { ...initialState(), room: 'threshold' }, { ...initialState(), room: 'toString' }, { ...initialState(), book: [null] }]) {
    assert.throws(() => parseState(JSON.stringify(value)));
  }
});
test('page and server action authenticate before reading saves and derive identity on the server', () => {
  const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const page = source('app/adventure/page.tsx'), action = source('app/adventure/actions.ts');
  assert.ok(page.indexOf('await requireUser()') < page.indexOf('const game = loadGame('));
  assert.match(page, /if \(!session\) redirect\('\/'\)/);
  assert.ok(action.indexOf('await requireUser()') < action.indexOf('return advanceGame('));
  assert.match(action, /advanceGame\(db\(\), session.user!\.email!, revision, action\)/);
  assert.match(action, /playAdventure\(revision: number, action: string\)/);
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
    'garden:entry': { title: 'A kert', description: 'Kert.', art: '[kert]', rules: [{ id: 'garden:return', label: 'Vissza', kind: 'move', moveTo: 'threshold', message: 'Visszatérsz.' }] },
  }, connections: [{ from: 'threshold', rules: [{ id: 'garden:enter', label: 'Belépek a kertbe', kind: 'move', moveTo: 'garden:entry', message: 'Egy kert!', milestone: { id: 'garden:arrival', title: 'A kert', text: 'Egy elfeledett kertbe érkeztem. A történetem új irányt vett.' } }] }] };
  const catalog = createCatalog([...CHAPTERS, next]);
  const oldSave = escape(initialState());
  assert.deepEqual(parseState(JSON.stringify(oldSave), catalog), oldSave);
  assert.equal(availableActions(oldSave).some(action => action.id === 'garden:enter'), false, 'original catalog stays immutable');
  assert.ok(availableActions(oldSave, catalog).some(action => action.id === 'garden:enter'));
  let continued = applyAction(oldSave, 'garden:enter', catalog);
  assert.equal(continued.room, 'garden:entry');
  assert.deepEqual(continued.book.slice(0, -1), oldSave.book);
  assert.equal(continued.book.at(-1)!.chapter, next.title);
  continued = applyAction(continued, 'garden:return', catalog);
  assert.equal(continued.room, 'threshold');
  assert.deepEqual(parseState(JSON.stringify(continued), catalog), continued);
  assert.throws(() => createCatalog([...CHAPTERS, CHAPTERS[0]]));
  assert.throws(() => createCatalog([...CHAPTERS, { ...next, connections: [{ from: 'missing', rules: [] }] }]));
});
test('database initializes idempotently, isolates normalized accounts and reloads exact progress', () => {
  const database = new DatabaseSync(':memory:');
  try {
    initializeDatabase(database); initializeDatabase(database);
    const first = loadGame(database, ' One@Example.test ');
    assert.equal(first.revision, 0);
    const saved = advanceGame(database, 'one@example.test', 0, 'look:bed');
    assert.equal(saved.conflict, false);
    assert.deepEqual(loadGame(database, 'ONE@example.test'), saved.game);
    assert.deepEqual(loadGame(database, 'other@example.test').state, initialState());
    const conflict = advanceGame(database, 'one@example.test', 0, 'look:panel');
    assert.equal(conflict.conflict, true);
    assert.deepEqual(conflict.game, saved.game);
    assert.throws(() => advanceGame(database, 'one@example.test', 1, 'take:wire'));
    assert.throws(() => advanceGame(database, 'one@example.test', -1, 'look:panel'));
    assert.deepEqual(loadGame(database, 'one@example.test'), saved.game);
    database.prepare('UPDATE adventure_saves SET state_json=? WHERE owner=?').run('{"version":99}', 'one@example.test');
    assert.throws(() => loadGame(database, 'one@example.test'));
    assert.equal(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get('one@example.test')!.state_json, '{"version":99}');
  } finally { database.close(); }
});
