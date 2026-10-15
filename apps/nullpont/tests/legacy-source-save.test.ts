import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { aw, go, look, reload, use } from './helpers/awakening-route.ts';
import type { GameState } from '../lib/game/types.ts';

test('installed-release accepted source save keeps wrist evidence and the exact historical page on return, controls and reload', () => {
  // Text and stable IDs from installed 19161ed, not generated from the new catalog.
  const page = { id: aw('sources-separated'), chapter: 'awakening', title: 'Amit láttam, amit állítottak', text: 'Három forrásfajtát jelöltem meg az asztalon. A kilenc heg a csuklómon megfigyelhető volt. Az önkéntes karantén az ajtó állítása maradt. A nevem helyén pedig továbbra sem volt adat. Lenyomtam az ellenőrzőkart; a másolat a kapocsba csúszott, és kinyílt a kilépési fülke ajtaja. Az asztal a jelöléseket fogadta el, nem a múlt magyarázatát.', turn: 12 };
  const legacy: GameState = { ...initialState(), room: aw('source-room'), turns: 12, flags: ['door-open', ...['flow-latched', 'card-registered', 'sources-accepted', 'wrist-source-1', 'claim-source-2'].map(aw)], inventory: [aw('source-card')], book: [page] };
  let state = parseState(JSON.stringify(legacy));
  const verify = () => {
    const view = gameView({ state, revision: 0, updatedAt: 'now' });
    assert.match(view.scene.description, /csuklód kilenc hege/);
    const wrist = view.scene.spots.find(spot => spot.environment === aw('wrist-source'))!;
    assert.match(wrist.glyph!, /csuklomon kilenc heg/i);
    assert.doesNotMatch(wrist.glyph!, /ajton felirat/i);
    assert.ok(state.flags.includes(aw('sources-accepted')));
    assert.deepEqual(state.book, [page]);
    assert.deepEqual(state.inventory, legacy.inventory);
  };
  verify();
  state = look(state, 'wrist-source'); assert.match(state.message, /kilenc apró heg/); verify();
  state = use(state, 'source-check'); assert.match(state.message, /korábbi másolatot nem írják át/); verify();
  state = use(state, 'wrist-source'); state = reload(state); verify();
  state = reload(go(go(state, 'source-back'), 'sorting')); verify();
  state = go(state, 'decision'); assert.equal(state.room, aw('decision-room')); assert.deepEqual(state.book, [page]);
});
