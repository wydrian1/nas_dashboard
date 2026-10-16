import test from 'node:test';
import assert from 'node:assert/strict';
import art from '../lib/game/presentation/art/scenes.json' with { type: 'json' };
import { CATALOG } from '../lib/game/catalog.ts';
import { validatePresentation } from '../lib/game/presentation/index.ts';
import bindings from '../lib/game/presentation/bindings.json' with { type: 'json' };

test('the complete engraving collection uses a consistent compact character canvas', () => {
  assert.equal(Object.keys(art.scenes).length, 25);
  assert.equal(Object.keys(art.items).length, 9);
  let handlers = 0;
  for (const [id, scene] of Object.entries(art.scenes)) {
    const rows = scene.background.split('\n');
    assert.equal(rows.length, 20, id);
    assert.ok(rows.every(row => row.length === 100), `${id}: fixed 100-column grid`);
    assert.doesNotMatch(scene.background, /[^\x20-\x7e\n]/, id);
    handlers += scene.handlers.length;
  }
  assert.equal(handlers, 126);
  validatePresentation(art, bindings);
});

test('connection doorways fit the parent illustration without painting over another target', () => {
  for (const [parent, overlay] of [['threshold', 'connection:archive:entry'], ['archive:record-room', 'connection:relay:entry']] as const) {
    const connection = art.scenes[overlay].handlers[0];
    const background = art.scenes[parent].background.split('\n');
    for (let row = connection.row; row < connection.row + connection.height; row++) {
      assert.equal(background[row].slice(connection.col, connection.col + connection.width).trim(), '', `${parent}: reserved doorway background`);
    }
    const spots = CATALOG.scenes[parent].artSpots!;
    const ids = new Set(spots.map(spot => spot.id));
    assert.equal(ids.size, spots.length);
    for (let i = 0; i < spots.length; i++) for (const b of spots.slice(i + 1)) {
      const a = spots[i];
      assert.ok(!(a.row < b.row + b.height && b.row < a.row + a.height && a.col < b.col + b.width && b.col < a.col + a.width), `${parent}: ${a.id}/${b.id}`);
    }
  }
});

test('the door panorama retains eleven individually targetable closed doors', () => {
  const scene = art.scenes['awakening:corridor-doors'];
  assert.equal(scene.handlers.length, 11);
  for (const handler of scene.handlers) assert.ok(handler.width >= 3 && handler.height >= 3);
  const picture = [scene.background, ...scene.handlers.map(h => h.glyph ?? '')].join('\n');
  for (const number of ['70', '80', '90']) assert.ok(picture.includes(number), `door ${number}`);
});
