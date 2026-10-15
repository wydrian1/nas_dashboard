import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../lib/game/catalog.ts';
import { initialState, applyAction, applyCommand, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { openOriginal } from './helpers/awakening-route.ts';
import type { ArtSpot, GameState } from '../lib/game/types.ts';

function composed(state: GameState) {
  const scene = gameView({ state, revision: 0, updatedAt: 'now' }).scene;
  const rows = scene.art.split('\n').map(line => line.padEnd(scene.columns));
  for (const spot of scene.spots) if (spot.glyph !== undefined) {
    const glyph = spot.glyph.split('\n');
    for (let row = 0; row < glyph.length; row++) rows[spot.row + row] = rows[spot.row + row].slice(0, spot.col) + glyph[row] + rows[spot.row + row].slice(spot.col + glyph[row].length);
  }
  return rows.join('\n');
}
const rectangle = (picture: string, spot: ArtSpot) => picture.split('\n').slice(spot.row, spot.row + spot.height).map(line => line.padEnd(spot.col + spot.width).slice(spot.col, spot.col + spot.width)).join('\n');

test('unselected opening overlays preserve the original closed panel, door and contacts; selected open drawings survive return and reload', () => {
  let state = initialState();
  const root = CATALOG.scenes.chamber;
  const panel = root.artSpots!.find(spot => spot.environment === 'panel')!;
  const door = root.artSpots!.find(spot => spot.environment === 'door')!;
  for (const spot of [panel, door]) {
    assert.equal(rectangle(composed(state), spot), rectangle(root.art, spot));
    assert.ok(rectangle(composed(state), spot).trim());
  }
  state = applyAction(state, 'look:panel');
  const detail = CATALOG.scenes['awakening:panel-detail'];
  const contacts = detail.artSpots!.find(spot => spot.environment === 'awakening:panel-contacts')!;
  assert.equal(rectangle(composed(state), contacts), rectangle(detail.art, contacts));
  state = parseState(JSON.stringify(state));
  assert.equal(rectangle(composed(state), contacts), rectangle(detail.art, contacts));
  state = applyCommand(state, { verb: 'back' });
  assert.equal(rectangle(composed(state), panel), rectangle(root.art, panel));
  state = applyCommand(openOriginal(), { verb: 'move', target: { kind: 'exit', id: 'chamber' } });
  for (const spot of [panel, door]) {
    assert.notEqual(rectangle(composed(state), spot), rectangle(root.art, spot));
    assert.match(rectangle(composed(state), spot), spot === door ? /NYITVA/ : /\*==\*/);
  }
  const opened = composed(state);
  state = parseState(JSON.stringify(state)); assert.equal(composed(state), opened);
  state = applyAction(state, 'look:panel');
  assert.match(rectangle(composed(state), contacts), /==========================/);
  const activeContacts = rectangle(composed(state), contacts);
  state = parseState(JSON.stringify(state)); assert.equal(rectangle(composed(state), contacts), activeContacts);
  state = applyCommand(state, { verb: 'back' }); assert.equal(composed(state), opened);
});
