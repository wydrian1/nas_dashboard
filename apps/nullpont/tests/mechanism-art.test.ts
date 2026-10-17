import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, initialState, observeRoom, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import type { GameState, PlayerCommand } from '../lib/game/types.ts';

const at = (room: string, flags: string[] = [], inventory: string[] = []) => observeRoom({ ...initialState(), room, flags, inventory });
const view = (state: GameState) => gameView({ state, revision: 1, updatedAt: 'now' });
const glyph = (state: GameState, entity: string) => view(state).scene.spots.find(spot => spot.environment === entity)!.glyph!;
const use = (state: GameState, name: string) => applyCommand(state, { verb: 'use', target: { kind: 'environment', id: name } });
const look = (state: GameState, name: string) => applyCommand(state, { verb: 'look', target: { kind: 'environment', id: name } });
const go = (state: GameState, name: string) => applyCommand(state, { verb: 'move', target: { kind: 'exit', id: name } });

test('counterweight art shows all nine rope positions independently of the latched basket, through reload and return', () => {
  const start = at('relay:well-room', ['door-open', 'relay:rhythm-open']);
  const pictures = new Set<string>();
  const names = ['alsó', 'középső', 'felső'];
  for (const ready of [false, true]) for (let left = 0; left < 3; left++) for (let right = 0; right < 3; right++) {
    let state = ready ? { ...start, flags: [...start.flags, 'relay:lift-ready'] } : start;
    for (let step = 0; step < left; step++) state = use(state, 'relay:left-wheel');
    for (let step = 0; step < right; step++) state = use(state, 'relay:right-wheel');
    const art = glyph(state, 'relay:alignment'), lines = art.split('\n');
    // New compact composition; assert actual physical heights, not old canvas rows.
    assert.equal(lines.findIndex(line => line.includes('|_|_|')), [9, 6, 3][left]);
    assert.equal(lines.findIndex(line => line.includes('|___|')), [9, 6, 3][right]);
    assert.equal(lines.findIndex(line => line.includes('.--------.')), ready ? 3 : 11);
    assert.ok(view(state).scene.description.includes(`villa a${left === 0 ? 'z' : ''} ${names[left]} jelhez`));
    assert.ok(view(state).scene.description.includes(`keresztgerenda a${right === 0 ? 'z' : ''} ${names[right]} jelhez`));
    assert.match(view(state).scene.description, ready ? /rögzítve/ : /járda alatt/);
    assert.equal(glyph(parseState(JSON.stringify(state)), 'relay:alignment'), art);
    pictures.add(art);
  }
  assert.equal(pictures.size, 18);
  let state = use(use(use(start, 'relay:left-wheel'), 'relay:left-wheel'), 'relay:right-wheel');
  const lowBasket = glyph(state, 'relay:alignment');
  state = look(state, 'relay:alignment');
  assert.notEqual(glyph(state, 'relay:alignment'), lowBasket);
  state = use(state, 'relay:left-wheel');
  assert.equal(glyph(state, 'relay:alignment').split('\n').findIndex(line => line.includes('.--------.')), 3);
  const art = glyph(state, 'relay:alignment'), book = state.book;
  state = go(go(state, 'relay:dispatch'), 'relay:dispatch-back');
  assert.equal(glyph(state, 'relay:alignment'), art);
  assert.deepEqual(state.book.slice(0, book.length), book);
  assert.equal(state.book.filter(entry => entry.id === 'relay:execution-read').length, 1, 'the newly reached service document has its own page');
  assert.doesNotMatch(JSON.stringify(view(state)), /glyphVariants|withoutFlags|left-high|right-mid|requires/);
});

test('rhythm-door art shows individual retracted latches, failed reset and the permanent open state', () => {
  let state = at('relay:interval-room', ['door-open']);
  const door = (state: GameState) => view(state).scene.spots.find(spot => spot.exit?.id === 'relay:well')!.glyph!;
  const closed = door(state);
  const extendedLatches = (picture: string) => (picture.match(/--------\]---\[---/g) ?? []).length;
  assert.equal(extendedLatches(closed), 3);
  state = use(state, 'relay:single'); assert.equal(extendedLatches(door(state)), 2); assert.match(view(state).scene.description, /bal retesze behúzódott/);
  state = use(state, 'relay:double'); assert.equal(extendedLatches(door(state)), 1); assert.match(view(state).scene.description, /bal és középső/);
  state = use(state, 'relay:double'); assert.equal(door(state), closed);
  state = look(use(use(state, 'relay:single'), 'relay:double'), 'relay:rest');
  assert.equal(extendedLatches(door(state)), 0); assert.notEqual(door(state), closed);
  assert.equal(door(parseState(JSON.stringify(state))), door(state));
  assert.equal(door(use(state, 'relay:single')), door(state));
});

test('opening contact illumination and archive indicators/dial use only the current public state', () => {
  const root = { ...initialState(), inventory: ['bridge'] };
  const detail = look(root, 'panel');
  const opened = applyCommand(detail, { verb: 'use', item: 'bridge', target: { kind: 'environment', id: 'awakening:panel-contacts' } });
  assert.notEqual(glyph(detail, 'awakening:panel-contacts'), glyph(opened, 'awakening:panel-contacts'));
  assert.match(glyph(opened, 'awakening:panel-contacts'), /={10}/);
  assert.match(glyph(applyCommand(opened, { verb: 'back' }), 'panel'), /HANGMINTA ELFOGADVA/);
  const images = new Set<string>();
  for (const route of [false, true]) for (const ground of [false, true]) {
    const state = at('archive:bridge-room', ['door-open', ...(route ? ['archive:route-bridge'] : []), ...(ground ? ['archive:ground-outer'] : [])]);
    images.add(glyph(state, 'archive:tongue') || view(state).scene.art);
  }
  assert.equal(images.size, 4);
  const locked = at('archive:vestibule', ['door-open']);
  assert.doesNotMatch(JSON.stringify(view(locked)), /\[4\].*\[2\].*\[7\]/);
  const unlocked = applyCommand(locked, { verb: 'submit', target: { kind: 'environment', id: 'archive:reader' }, input: '427' });
  assert.match(glyph(unlocked, 'archive:reader'), /\[4\].*\[2\].*\[7\]/);
  assert.deepEqual(parseState(JSON.stringify(unlocked)).book, locked.book);
});

test('accepted request changes the visible tray and exit without duplicating or rewriting saved history', () => {
  const state = at('relay:dispatch-room', ['door-open', 'relay:lift-ready']);
  const command: PlayerCommand = { verb: 'submit', target: { kind: 'environment', id: 'relay:missing-tray' }, input: '09' };
  const submitted = applyCommand(state, command);
  assert.notEqual(glyph(submitted, 'relay:missing-tray'), glyph(state, 'relay:missing-tray'));
  assert.match(glyph(submitted, 'relay:missing-tray'), /09.*\[x\]/);
  const exitPicture = (state: GameState) => view(state).scene.spots.find(spot => spot.exit?.id === 'relay:receiver')!.glyph!;
  assert.notEqual(exitPicture(submitted), exitPicture(state));
  assert.match(exitPicture(submitted), /FOGADOALLOMAS/);
  assert.match(exitPicture(submitted), /:\/\s+:/, 'open leaf leaves a visible passage');
  assert.equal(exitPicture(parseState(JSON.stringify(submitted))), exitPicture(submitted));
  const returned = go(go(submitted, 'relay:receiver'), 'relay:receiver-back');
  assert.equal(glyph(parseState(JSON.stringify(returned)), 'relay:missing-tray'), glyph(submitted, 'relay:missing-tray'));
  assert.deepEqual(applyCommand(submitted, command).book, submitted.book);
  assert.deepEqual(submitted.book.slice(0, state.book.length), state.book);
});
