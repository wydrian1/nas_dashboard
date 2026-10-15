import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, createCatalog } from '../lib/game/catalog.ts';
import { archive } from '../lib/game/chapters/archive.ts';
import { awakening } from '../lib/game/chapters/awakening.ts';
import { applyAction, applyCommand, initialState, parseState } from '../lib/game/engine.ts';
import type { GameState, PlayerCommand } from '../lib/game/types.ts';
import { gameView } from '../lib/game/view.ts';
import { closeAwakening } from './helpers/awakening-route.ts';

const catalog = createCatalog([...CHAPTERS.filter(chapter => chapter.id !== archive.id), archive]);
const command = (state: GameState, verb: PlayerCommand['verb'], name?: string, input?: string) => applyCommand(state, {
  verb, ...(name ? { target: { kind: verb === 'move' ? 'exit' : 'environment', id: `archive:${name}` } } : {}), ...(input !== undefined ? { input } : {}),
}, catalog);
const view = (state: GameState) => gameView({ state, revision: 0, updatedAt: 'now' }, catalog);
function threshold() {
  let state = initialState();
  state = applyAction(state, 'look:bed', catalog);
  if (state.focus?.length) state = applyAction(state, 'look:rim', catalog);
  state = applyAction(state, 'take:foil', catalog);
  if (state.focus?.length) state = applyCommand(state, { verb: 'back', levels: state.focus.length }, catalog);
  state = applyAction(state, 'look:panel', catalog);
  state = applyAction(state, 'take:wire', catalog);
  if (state.focus?.length) state = applyCommand(state, { verb: 'back', levels: state.focus.length }, catalog);
  for (const action of ['combine:foil:wire', 'use:bridge:panel', 'move:threshold']) state = applyAction(state, action, catalog);
  return closeAwakening(state);
}
const enter = () => command(threshold(), 'move', 'entry');
function openRecords(state = enter()) {
  state = command(state, 'move', 'bridge');
  state = command(state, 'look', 'gauges');
  state = command(state, 'move', 'bridge-return');
  state = command(state, 'submit', 'reader', '427');
  return state;
}
function readSignal(state = openRecords()) {
  if (!state.flags.includes('archive:records-open')) state = openRecords(state);
  state = command(state, 'move', 'records');
  state = command(state, 'look', 'work-sheet');
  state = command(state, 'move', 'records-return');
  state = command(state, 'move', 'signals');
  state = command(state, 'submit', 'route', 'HID');
  state = command(state, 'submit', 'ground', 'KULSO');
  state = command(state, 'move', 'signals-return');
  state = command(state, 'move', 'bridge');
  return command(state, 'look', 'tongue');
}

test('archive attaches four physical locations without modifying the published chapter or old pages', () => {
  const published = JSON.stringify(awakening);
  const old = threshold();
  assert.deepEqual(parseState(JSON.stringify(old), catalog), old);
  let state = command(old, 'move', 'entry');
  assert.deepEqual(state.book.slice(0, old.book.length), old.book);
  assert.equal(state.book.at(-1)!.chapter, archive.title);
  for (const [out, back, room] of [['bridge', 'bridge-return', 'bridge-room'], ['signals', 'signals-return', 'signal-room']]) {
    state = command(state, 'move', out);
    assert.equal(state.room, `archive:${room}`);
    state = command(state, 'move', back);
    assert.equal(state.room, 'archive:vestibule');
  }
  state = openRecords(state);
  state = command(state, 'move', 'records');
  assert.equal(state.room, 'archive:record-room');
  state = command(state, 'move', 'records-return');
  state = command(state, 'move', 'threshold');
  assert.equal(state.room, 'threshold');
  assert.deepEqual(state.book.slice(0, old.book.length), old.book);
  assert.equal(JSON.stringify(awakening), published);
  assert.equal(Object.values(archive.scenes).filter(scene => !scene.detailOf).length, 4);
});

test('nested inspection preserves physical room, reveals a deferred item only after investigation and saves focus', () => {
  let state = enter();
  assert.ok(!JSON.stringify(view(state)).includes('archive:witness'));
  state = command(state, 'look', 'board');
  assert.equal(state.room, 'archive:vestibule');
  assert.deepEqual(state.focus, ['archive:directory']);
  state = command(state, 'look', 'addresses');
  assert.match(state.message, /ugyanannak az átjárónak/);
  state = command(state, 'look', 'margin');
  assert.deepEqual(state.focus, ['archive:directory', 'archive:paper-fold']);
  assert.equal(view(state).breadcrumbs.length, 3);
  assert.ok(!JSON.stringify(view(state)).includes('archive:loose-witness'));
  assert.throws(() => command(state, 'take', 'loose-witness'));
  state = command(state, 'look', 'pencil');
  assert.ok(view(state).scene.spots.some(spot => spot.environment === 'archive:loose-witness' && spot.glyph));
  state = command(state, 'look', 'loose-witness');
  assert.match(state.message, /félholdas/);
  state = command(state, 'take', 'loose-witness');
  assert.ok(state.inventory.includes('archive:witness'));
  assert.ok(!view(state).scene.spots.some(spot => spot.environment === 'archive:loose-witness'));
  assert.deepEqual(parseState(JSON.stringify(state), catalog), state);
  state = applyCommand(state, { verb: 'look', target: { kind: 'item', id: 'archive:witness' } }, catalog);
  assert.match(state.message, /HELYBEN NEM OLVASHATÓ/);
  state = command(command(state, 'back'), 'back');
  assert.equal(view(state).scene.id, 'archive:vestibule');
  state = readSignal(state);
  assert.ok(state.inventory.includes('archive:witness'));
  assert.ok(state.inventory.includes('bridge'));
  state = command(command(state, 'move', 'bridge-return'), 'move', 'threshold');
  assert.ok(state.inventory.includes('archive:witness'));
  assert.deepEqual(parseState(JSON.stringify(state), catalog), state);
  assert.ok(!Object.values(archive.scenes).flatMap(scene => scene.rules).some(rule => rule.removeItems?.includes('archive:witness')));
});

test('observational lock accepts only the exact three-position reading and does not publish its rule', () => {
  let state = enter();
  const publicView = JSON.stringify(view(state));
  assert.ok(!publicView.includes('427'));
  assert.ok(!publicView.includes('submit:reader'));
  assert.equal(view(state).inputs[0].id, 'archive:reader');
  for (const wrong of ['000', '724', '42']) {
    const trial = command(state, 'submit', 'reader', wrong);
    assert.ok(!trial.flags.includes('archive:records-open'));
    assert.equal(command(trial, 'move', 'records').room, 'archive:vestibule');
    assert.deepEqual(trial.inventory, state.inventory);
  }
  state = command(state, 'move', 'bridge');
  state = command(state, 'look', 'gauges');
  assert.match(state.message, /4.*2.*7/);
  state = command(state, 'move', 'bridge-return');
  state = command(state, 'submit', 'reader', ' 427 ');
  assert.ok(state.flags.includes('archive:records-open'));
  assert.equal(command(state, 'move', 'records').room, 'archive:record-room');
});

test('route and grounding form a reversible control puzzle: every configuration can recover', () => {
  for (const route of ['HID', 'TAR']) for (const ground of ['KULSO', 'BELSO']) {
    let state = openRecords();
    const inventory = [...state.inventory];
    state = command(state, 'move', 'signals');
    // First energize both branches, then request each configuration. This catches
    // additive-only implementations that cannot actually switch a control back.
    state = command(state, 'submit', 'route', 'HID');
    state = command(state, 'submit', 'ground', 'KULSO');
    state = command(state, 'submit', 'route', route);
    state = command(state, 'submit', 'ground', ground);
    assert.equal(state.flags.includes('archive:route-bridge'), route === 'HID');
    assert.equal(state.flags.includes('archive:ground-outer'), ground === 'KULSO');
    assert.deepEqual(parseState(JSON.stringify(state), catalog), state);
    state = command(state, 'move', 'signals-return');
    state = command(state, 'move', 'bridge');
    state = command(state, 'look', 'tongue');
    assert.equal(state.book.some(entry => entry.id === 'archive:signal-read'), route === 'HID' && ground === 'KULSO');
    const once = structuredClone(state.book);
    state = command(state, 'look', 'tongue');
    assert.deepEqual(state.book, once);
    state = command(state, 'move', 'bridge-return');
    state = readSignal(state);
    assert.ok(state.book.some(entry => entry.id === 'archive:signal-read'));
    assert.deepEqual(state.inventory, inventory);
    state = command(command(state, 'move', 'bridge-return'), 'move', 'threshold');
    assert.equal(state.room, 'threshold');
  }
});

test('every authored environment examine is substantive and every object and exit has an ASCII target', () => {
  const proseBan = /Nem fogyott el|nem sérült|nálad marad|Semmit nem veszített|Kösd össze|Talán kombinálni/;
  for (const [sceneId, scene] of Object.entries(archive.scenes)) {
    assert.doesNotMatch(scene.art, /[^\x20-\x7e\n]/);
    for (const entity of scene.environment ?? []) {
      assert.ok(scene.artSpots!.some(spot => spot.environment === entity.id));
      assert.ok(entity.description!.length > 65, entity.id);
      assert.doesNotMatch(entity.description!, proseBan);
    }
    for (const exit of scene.exits ?? []) assert.ok(scene.artSpots!.some(spot => spot.exit === exit.id));
    for (const rule of scene.rules) {
      assert.ok(rule.id.startsWith('archive:'));
      assert.doesNotMatch(rule.message, proseBan);
      if (rule.moveTo) assert.ok(!catalog.scenes[rule.moveTo].detailOf);
      if (rule.focusTo) assert.equal(catalog.scenes[rule.focusTo].detailOf, sceneId);
      assert.ok(rule.kind !== 'combine', 'new puzzles do not repeat the opening recipe');
    }
  }
});

test('optional conversation, hostile interaction and repeated address reading preserve progress', () => {
  let state = enter();
  state = command(state, 'look', 'board');
  state = command(state, 'look', 'addresses');
  const book = structuredClone(state.book);
  state = command(state, 'look', 'addresses');
  assert.deepEqual(state.book, book);
  state = command(state, 'back');
  state = command(state, 'move', 'signals');
  state = command(state, 'talk', 'tube');
  assert.match(state.message, /széket/);
  for (const topic of ['tube-place', 'tube-name']) {
    state = applyCommand(state, { verb: 'talk', target: { kind: 'environment', id: 'archive:tube' }, topic: `archive:${topic}` }, catalog);
    assert.ok(state.message.length > 80);
  }
  state = command(state, 'attack', 'tube');
  assert.match(state.message, /negyedik/);
  state = command(state, 'move', 'signals-return');
  state = readSignal(state);
  assert.ok(state.book.some(entry => entry.id === 'archive:signal-read'));
  assert.deepEqual(parseState(JSON.stringify(state), catalog), state);
});
