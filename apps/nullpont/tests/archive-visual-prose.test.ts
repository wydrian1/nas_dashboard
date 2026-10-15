import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, observeRoom, applyCommand, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
const at = (room: string, flags: string[] = []) => observeRoom({ ...initialState(), room, flags: ['door-open', 'awakening:chapter-closed', ...flags] });
const view = (state: ReturnType<typeof at>) => gameView({ state, revision: 0, updatedAt: 'now' });
const examine = (state: ReturnType<typeof at>, id: string) => applyCommand(state, { verb: 'look', target: { kind: 'environment', id } });

test('actual archive examine commands acknowledge visible reader and hood inscriptions in every control state and after reload', () => {
  for (const flags of [[], ['archive:records-open']]) {
    let state = at('archive:vestibule', flags);
    for (let repeat = 0; repeat < 2; repeat++) {
      assert.match(view(state).scene.spots.find(spot => spot.environment === 'archive:reader')!.glyph!, /HELYI SZEMLE/);
      state = examine(state, 'archive:reader');
      assert.match(state.message, /HELYI SZEMLE/);
      state = parseState(JSON.stringify(state));
    }
  }
  for (const flags of [[], ['archive:ground-outer'], ['archive:route-bridge'], ['archive:route-bridge', 'archive:ground-outer']]) {
    let state = at('archive:bridge-room', flags);
    for (let repeat = 0; repeat < 2; repeat++) {
      assert.match(view(state).scene.spots.find(spot => spot.environment === 'archive:tongue')!.glyph!, /OLVASAS \/ KULSO HIDAG/);
      state = examine(state, 'archive:tongue');
      assert.match(state.message, /OLVASÁS \/ KÜLSŐ HÍDÁG/);
      state = parseState(JSON.stringify(state));
    }
  }
});

test('vestibule prose matches the actual separate return, right bridge and lower signal-stair targets before and after opening records', () => {
  for (const flags of [[], ['archive:records-open']]) {
    const current = view(at('archive:vestibule', flags));
    const spot = (id: string) => current.scene.spots.find(spot => spot.exit?.id === 'archive:' + id)!;
    assert.match(current.scene.description, /Balra a körfolyosóra/);
    assert.match(current.scene.description, /irattári ajtótól jobbra.*megfigyelőhídra/);
    assert.match(current.scene.description, /Alatta külön, JELFÜLKE feliratú lépcsőlejáró/);
    assert.ok(spot('threshold').col < spot('records').col);
    assert.ok(spot('records').col < spot('bridge').col);
    assert.ok(spot('bridge').row + spot('bridge').height <= spot('signals').row);
  }
});
