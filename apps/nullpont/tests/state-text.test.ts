import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyAction, applyCommand, parseState, observeRoom } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { CATALOG, createCatalog, CHAPTERS } from '../lib/game/catalog.ts';
import type { GameState } from '../lib/game/types.ts';

const view = (state: GameState) => gameView({ state, revision: 1, updatedAt: 'now' });
const at = (room: string, flags: string[] = [], inventory: string[] = []): GameState => observeRoom({ ...initialState(), room, flags, inventory });

test('taken foil and wire disappear through crafting, nested return and reload without rewriting history', () => {
  let state = applyAction(initialState(), 'look:bed');
  state = applyAction(state, 'look:rim');
  state = applyAction(state, 'take:foil');
  assert.match(view(state).scene.description, /üres/);
  assert.ok(!view(state).environment.some(entity => entity.id === 'loose-foil'));
  state = applyCommand(state, { verb: 'back', levels: 2 });
  state = applyAction(state, 'look:panel');
  state = applyAction(state, 'take:wire');
  state = applyAction(state, 'combine:foil:wire');
  state = parseState(JSON.stringify(state));
  assert.match(applyCommand(state, { verb: 'look' }).message, /üres/);
  assert.ok(!view(state).scene.spots.some(spot => spot.environment === 'loose-wire'));
  const book = JSON.stringify(state.book);
  state = applyCommand(state, { verb: 'back' });
  state = applyAction(state, 'look:bed');
  state = applyAction(state, 'look:rim');
  assert.match(view(state).scene.description, /üres/);
  assert.equal(JSON.stringify(state.book), book);
});

test('retained pickups do not respawn in repeat inspections or detail descriptions', () => {
  const witness = at('archive:vestibule', ['door-open'], ['archive:witness']);
  witness.focus = ['archive:directory', 'archive:paper-fold'];
  witness.discoveries.push('archive:pencil', 'archive:loose-witness');
  assert.match(applyAction(witness, 'archive:look:pencil').message, /üres bemetszés/);
  assert.match(view(witness).scene.description, /üres/);
  assert.ok(!view(witness).environment.some(entity => entity.id === 'archive:loose-witness'));
  const seal = at('relay:well-room', ['relay:rhythm-open'], ['relay:blank-seal']);
  seal.discoveries.push('relay:ledge', 'relay:loose-seal');
  assert.match(applyAction(seal, 'relay:look:ledge').message, /már elvitted/);
  assert.ok(!view(seal).scene.spots.some(spot => spot.environment === 'relay:loose-seal'));
});

test('opened doors, latched lift, controls and visible inscriptions reflect current state', () => {
  const opened = at('chamber', ['door-open']);
  assert.match(applyAction(opened, 'look:room').message, /nyitva/);
  assert.match(applyAction(opened, 'look:door').message, /nyitva/);
  assert.match(view(opened).scene.spots.find(spot => spot.id === 'door')!.glyph!, /NYITVA/);
  assert.match(applyAction(at('threshold', ['door-open']), 'look:hall').message, /NEM VAGY EGYEDÜL/);
  const lift = at('relay:well-room', ['relay:lift-ready']);
  assert.match(applyAction(lift, 'relay:look:alignment').message, /rögzítőfék/);
  assert.match(view(lift).scene.description, /rögzítve/);
  const controls = at('archive:signal-room', ['archive:route-bridge']);
  assert.match(view(controls).scene.spots.find(spot => spot.environment === 'archive:route')!.glyph!, /HID/);
  const request = at('relay:dispatch-room', ['relay:request-sent']);
  assert.match(applyCommand(request, { verb: 'look', target: { kind: 'environment', id: 'relay:missing-tray' } }).message, /09/);
  assert.match(view(request).scene.description, /nyitva/);
});

test('variant requirements stay server-only and invalid requirements or oversized art reject', () => {
  const payload = JSON.stringify(view(initialState()));
  assert.doesNotMatch(payload, /messageVariants|descriptionVariants|glyphVariants|withoutFlags|withoutItems/);
  const chapters = structuredClone(CHAPTERS);
  chapters[0].scenes.chamber.descriptionVariants = [{ requires: { flags: ['unknown:flag'] }, text: 'Invalid' }];
  assert.throws(() => createCatalog(chapters), /szövegfeltétel/);
  const art = structuredClone(CHAPTERS);
  art[0].scenes.chamber.artSpots![0].glyphVariants = [{ requires: {}, text: 'X'.repeat(100) }];
  assert.throws(() => createCatalog(art), /ASCII/);
  assert.ok(CATALOG.scenes.chamber);
});
