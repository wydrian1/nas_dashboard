import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CHAPTERS, createCatalog } from '../lib/game/catalog.ts';
import { relay } from '../lib/game/chapters/relay.ts';
import { applyAction, applyCommand, initialState, observeRoom, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import type { GameState, PlayerCommand, Rule } from '../lib/game/types.ts';

const command = (state: GameState, verb: PlayerCommand['verb'], name: string, input?: string) => applyCommand(state, { verb, target: { kind: verb === 'move' ? 'exit' : 'environment', id: `relay:${name}` }, ...(input === undefined ? {} : { input }) });
const view = (state: GameState) => gameView({ state, revision: 7, updatedAt: 'now' });
function gallery() {
  // An old persisted room is a valid entry, without fabricating new chapter flags.
  const state = parseState(JSON.stringify({ ...initialState(), room: 'archive:record-room', flags: ['door-open', 'archive:records-open'] }));
  return command(state, 'move', 'entry');
}
const interval = () => command(gallery(), 'move', 'interval');
function openRhythm(state: GameState) {
  return command(command(command(state, 'use', 'single'), 'use', 'double'), 'look', 'rest');
}
const well = () => command(openRhythm(interval()), 'move', 'well');
function openLift(state: GameState) {
  for (const side of ['left', 'right']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (state.flags.includes(`relay:${side === 'left' ? 'left-high' : 'right-mid'}`)) break;
      state = command(state, 'use', `${side}-wheel`);
    }
  }
  return command(state, 'look', 'alignment');
}
const dispatch = () => command(openLift(well()), 'move', 'dispatch');

test('five physical scenes append to the old archive with return paths and a concrete earned goal', () => {
  assert.equal(Object.values(relay.scenes).filter(scene => !scene.detailOf).length, 5);
  const oldCatalog = createCatalog(CHAPTERS.filter(chapter => chapter.id !== 'relay'));
  const old = observeRoom({ ...initialState(), room: 'archive:record-room', flags: ['door-open', 'archive:records-open'] }, oldCatalog);
  const restored = parseState(JSON.stringify(old));
  for (const key of ['room', 'flags', 'inventory', 'journal', 'book', 'turns', 'message'] as const) assert.deepEqual(restored[key], old[key]);
  assert.equal(view(initialState()).goal, undefined);
  const state = gallery();assert.match(view(state).goal!, /Fogadóállomás/);
  assert.equal(command(state, 'move', 'gallery-back').room, 'archive:record-room');
  const focused = command(state, 'look', 'clock');assert.equal(focused.room, state.room);
  assert.equal(view(focused).breadcrumbs.length, 2);assert.equal(view(focused).goal, view(state).goal);
  assert.deepEqual(parseState(JSON.stringify(focused)), focused);
  assert.doesNotMatch(JSON.stringify(view(initialState())), /Fogadóállomás|beat-one|left-high/);
});

test('rhythm puzzle accepts a deliberate pause, recovers after every finite control state and latches open', () => {
  const key = (state: GameState) => JSON.stringify([...state.flags].sort());
  const queue = [interval()], seen = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];if (seen.has(key(state))) continue;seen.add(key(state));
    assert.equal(command(openRhythm(state), 'move', 'well').room, 'relay:well-room');
    assert.equal(command(state, 'move', 'interval-back').room, 'relay:gallery');
    for (const [verb, name] of [['use', 'single'], ['use', 'double'], ['look', 'rest']] as const) queue.push(command(state, verb, name));
    assert.deepEqual(parseState(JSON.stringify(state)), state);assert.ok(seen.size < 10);
  }
  assert.ok(seen.size >= 4);
  const start = interval();assert.equal(command(command(start, 'use', 'double'), 'move', 'well').room, start.room);
  let solved = openRhythm(start);for (let repeat = 0; repeat < 8; repeat++) solved = command(command(solved, 'use', 'double'), 'look', 'rest');
  assert.ok(solved.flags.includes('relay:rhythm-open'));
  assert.equal(solved.journal.filter(note => note.includes('harmadik ütem')).length, 1);
});

test('both three-position counterweights are reversible; every combination recovers without inventory', () => {
  const base = well();assert.equal(command(base, 'move', 'dispatch').room, base.room);
  for (let left = 0; left < 3; left++) for (let right = 0; right < 3; right++) {
    let state = base;
    for (let i = 0; i < left; i++) state = command(state, 'use', 'left-wheel');
    for (let i = 0; i < right; i++) state = command(state, 'use', 'right-wheel');
    const inspected = command(state, 'look', 'alignment');assert.equal(inspected.flags.includes('relay:lift-ready'), left === 2 && right === 1);
    const solved = openLift(state);assert.ok(solved.flags.includes('relay:lift-ready'));
    assert.deepEqual(solved.inventory, base.inventory);assert.equal(command(solved, 'move', 'dispatch').room, 'relay:dispatch-room');
    assert.deepEqual(parseState(JSON.stringify(state)), state);
    assert.equal(command(state, 'move', 'well-back').room, 'relay:interval-room');
    const cycled = command(command(command(state, 'use', 'left-wheel'), 'use', 'left-wheel'), 'use', 'left-wheel');assert.deepEqual([...cycled.flags].sort(), [...state.flags].sort());
  }
});

test('semantic missing-document request needs no name, preserves optional items and yields a real progress milestone', () => {
  let state = dispatch();const before = [...state.book];
  for (const tray of ['name-tray', 'correction-tray']) {
    state = command(state, 'use', tray);assert.ok(!state.flags.includes('relay:request-sent'));
    assert.equal(command(state, 'move', 'receiver').room, 'relay:dispatch-room');
  }
  for (const input of ['90', '00', '9', '', 'a']) {
    const wrong = command(state, 'submit', 'missing-tray', input);assert.deepEqual(wrong.flags, state.flags);assert.deepEqual(wrong.book, state.book);assert.deepEqual(wrong.inventory, state.inventory);
  }
  assert.ok(!JSON.stringify(view(state).inputs).includes('09'));
  state = command(state, 'submit', 'missing-tray', '09');assert.deepEqual(state.book.slice(0, before.length), before);
  state = command(state, 'move', 'receiver');assert.equal(state.room, 'relay:receiver-room');
  state = command(state, 'look', 'reply');assert.match(view(state).goal!, /eredetijét.*olvasó/);
  assert.match(state.message, /kérelem és az engedély/i);assert.match(state.message, /nem igazolja/);
  const book = [...state.book];state = command(command(state, 'look', 'reply'), 'look', 'reply');assert.deepEqual(state.book, book);
  state = { ...state, inventory: ['archive:witness'] };
  state = applyCommand(state, { verb: 'use', item: 'archive:witness', target: { kind: 'environment', id: 'relay:tube-mouth' } });assert.deepEqual(state.inventory, ['archive:witness']);
  assert.equal(command(state, 'move', 'receiver-back').room, 'relay:dispatch-room');
});

test('optional seal stays hidden until inspection and every context has substantive descriptions and nonoverlapping ASCII spots', () => {
  let state = well();assert.ok(!view(state).environment.some(entity => entity.id === 'relay:loose-seal'));
  assert.throws(() => command(state, 'take', 'loose-seal'));
  state = command(state, 'look', 'ledge');state = command(state, 'take', 'loose-seal');assert.deepEqual(state.inventory, ['relay:blank-seal']);
  assert.ok(!view(state).scene.spots.some(spot => spot.environment === 'relay:loose-seal'));
  const arrived = command(command(command(openLift(state), 'move', 'dispatch'), 'submit', 'missing-tray', '09'), 'move', 'receiver');assert.deepEqual(arrived.inventory, state.inventory);
  for (const [sceneId, scene] of Object.entries(relay.scenes)) {
    assert.ok(!/[^\x20-\x7e\n]/.test(scene.art));
    for (const entity of scene.environment ?? []) {
      assert.ok(entity.description!.length > 60, `${sceneId}: ${entity.id}`);
      assert.ok(scene.artSpots!.some(spot => spot.environment === entity.id));
    }
    for (const exit of scene.exits ?? []) assert.ok(scene.artSpots!.some(spot => spot.exit === exit.id));
    const spots = scene.artSpots!;
    for (let a = 0; a < spots.length; a++) for (let b = a + 1; b < spots.length; b++) assert.ok(spots[a].col + spots[a].width <= spots[b].col || spots[b].col + spots[b].width <= spots[a].col || spots[a].row + spots[a].height <= spots[b].row || spots[b].row + spots[b].height <= spots[a].row, `overlap ${spots[a].id}/${spots[b].id}`);
  }
  assert.equal(CATALOG.scenes['archive:record-room'].exits!.filter(exit => exit.id === 'relay:entry').length, 1);
});

test('inventory-only combination works at every opening focus depth, in reverse order and after reload without exposing room actions', () => {
  let base = applyAction(applyAction(applyAction(initialState(), 'look:bed'), 'look:rim'), 'take:foil');
  base = applyCommand(base, { verb: 'back', levels: 2 });base = applyAction(applyAction(base, 'look:panel'), 'take:wire');
  const root = applyCommand(base, { verb: 'back' });
  const bed = applyAction(root, 'look:bed'), rim = applyAction(bed, 'look:rim');
  for (const original of [root, base, bed, rim, { ...root, room: 'relay:gallery' }]) for (const reverse of [false, true]) {
    const state = parseState(JSON.stringify(original)), inventory = [...state.inventory], book = [...state.book];
    const combined = applyCommand(state, { verb: 'combine', item: reverse ? 'wire' : 'foil', target: { kind: 'item', id: reverse ? 'foil' : 'wire' } });
    assert.deepEqual(combined.inventory, ['bridge']);assert.equal(combined.room, state.room);assert.deepEqual(combined.focus, state.focus);assert.deepEqual(state.inventory, inventory);
    assert.deepEqual(combined.book.slice(0, book.length), book);assert.equal(combined.book.at(-1)!.chapter, 'I. Az ébredés');assert.deepEqual(parseState(JSON.stringify(combined)), combined);
    const repeated = applyCommand(combined, { verb: 'look', target: { kind: 'item', id: 'bridge' } });assert.deepEqual(repeated.book, combined.book);
    if (state.focus?.length) {
      assert.throws(() => applyAction(combined, 'use:bridge:panel'));
      assert.throws(() => applyCommand(combined, { verb: 'use', item: 'bridge', target: { kind: 'environment', id: 'panel' } }));
    }
    assert.throws(() => applyCommand(combined, { verb: 'combine', item: 'foil', target: { kind: 'item', id: 'wire' } }));
    assert.ok(!JSON.stringify(view(state)).includes('portableRules'));
  }
});

test('portable rule validation cannot globalize environment, movement, hidden discovery or missing-item effects', () => {
  const base = CHAPTERS.find(chapter => chapter.id === 'awakening')!;
  for (const mutate of [
    (rule: Rule) => { rule.moveTo = 'threshold'; }, (rule: Rule) => { rule.focusTo = 'awakening:bed-detail'; },
    (rule: Rule) => { rule.interaction!.target = { kind: 'environment', id: 'panel' }; },
    (rule: Rule) => { rule.discover = ['bed']; }, (rule: Rule) => { rule.requires!.items = ['foil']; },
    (rule: Rule) => { rule.requires!.discoveries = ['bed']; },
  ]) {
    const chapter = structuredClone(base);mutate(chapter.scenes.chamber.rules.find(rule => rule.portable)!);assert.throws(() => createCatalog([chapter]));
  }
});
