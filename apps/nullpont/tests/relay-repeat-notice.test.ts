import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, observeRoom, applyCommand, parseState } from '../lib/game/engine.ts';

test('gallery review board examination stays time-neutral through repeat, return and reload without rewriting its milestone', () => {
  let state = observeRoom({ ...initialState(), room: 'relay:gallery', flags: ['door-open'] });
  const examine = () => { state = applyCommand(state, { verb: 'look', target: { kind: 'environment', id: 'relay:notice' } }); };
  examine();
  const book = structuredClone(state.book), inventory = [...state.inventory], message = state.message;
  assert.doesNotMatch(message, /Először/);
  assert.match(message, /megnevez egy helyet/);
  assert.equal(book.filter(page => page.id === 'relay:direction').length, 1);
  examine();
  assert.equal(state.message, message);
  assert.deepEqual(state.book, book);
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'relay:gallery-back' } });
  assert.equal(state.room, 'archive:record-room');
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'relay:entry' } });
  assert.equal(state.room, 'relay:gallery');
  state = parseState(JSON.stringify(state));
  examine();
  assert.equal(state.message, message);
  assert.deepEqual(state.book, book);
  assert.deepEqual(state.inventory, inventory);
});
