import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, observeRoom, applyCommand, parseState } from '../lib/game/engine.ts';

test('receiver reply remains time-neutral through repeated examination, return and reload without rewriting its milestone', () => {
  let state = observeRoom({ ...initialState(), room: 'relay:receiver-room', flags: ['door-open', 'relay:request-sent'] });
  const examine = () => { state = applyCommand(state, { verb: 'look', target: { kind: 'environment', id: 'relay:reply' } }); };
  examine();
  const book = structuredClone(state.book), inventory = [...state.inventory], message = state.message;
  assert.doesNotMatch(message, /először/);
  assert.match(message, /megjelölt olvasóterem/);
  assert.equal(book.filter(page => page.id === 'relay:received').length, 1);
  examine(); assert.equal(state.message, message); assert.deepEqual(state.book, book);
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'relay:receiver-back' } });
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'relay:receiver' } });
  state = parseState(JSON.stringify(state)); examine();
  assert.equal(state.message, message); assert.deepEqual(state.book.slice(0, book.length), book); assert.deepEqual(state.inventory, inventory);
  assert.equal(state.book.filter(page => page.id === 'relay:permit-read').length, 1, 'return arrival reads the new separate permit without rewriting the old reply page');
  const updatedBook = structuredClone(state.book); examine(); assert.deepEqual(state.book, updatedBook);
});
