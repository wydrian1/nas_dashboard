import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentation } from '../lib/game/presentation/index.ts';
import { createCatalog } from '../lib/game/catalog.ts';
import { applyCommand, observeRoom, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import type { Chapter, GameState } from '../lib/game/types.ts';

test('empty named pose erases an overlay through full catalog, rendering, return and save/reload', () => {
  const presentation = createPresentation({ version: 1, scenes: {
    sample: { background: 'old artwork\n           ', handlers: [{ id: 'h01', row: 0, col: 0, width: 11, height: 1, glyph: '[ PAPER ]', poses: { p01: '' } }, { id: 'h02', row: 1, col: 0, width: 11, height: 1, glyph: 'EXIT' }] },
    outside: { background: '           ', handlers: [{ id: 'h01', row: 0, col: 0, width: 11, height: 1, glyph: 'RETURN' }] },
  }, items: { paper: { glyph: '[ PAPER ]' } } }, { version: 1, scenes: {
    sample: [{ handler: 'h01', id: 'tray', environment: 'tray', actions: ['look', 'take'], variants: [{ requires: { flags: ['taken'] }, pose: 'p01' }] }, { handler: 'h02', id: 'leave', exit: 'leave' }],
    outside: [{ handler: 'h01', id: 'return', exit: 'return' }],
  } });
  const chapter: Chapter = { id: 'sample', title: 'Próba', items: { paper: 'Papír' }, itemDescriptions: { paper: 'Egy papírlap.' }, itemArt: presentation.itemArts(['paper']), scenes: {
    sample: { title: 'Pult', description: 'A pulton papír fekszik.', descriptionVariants: [{ requires: { flags: ['taken'] }, text: 'A pult üres.' }], ...presentation.bindScene('sample'), arrivalDiscoveries: ['tray'], environment: [{ id: 'tray', label: 'Pult' }], exits: [{ id: 'leave', label: 'Kifelé' }], rules: [
      { id: 'take', kind: 'take', label: 'Felveszem', interaction: { verb: 'take', target: { kind: 'environment', id: 'tray' } }, requires: { withoutFlags: ['taken'] }, addFlags: ['taken'], addItems: ['paper'], message: 'Felvetted a papírt.' },
      { id: 'look', kind: 'look', label: 'Megvizsgálom', interaction: { verb: 'look', target: { kind: 'environment', id: 'tray' } }, message: 'Papír fekszik rajta.', messageVariants: [{ requires: { flags: ['taken'] }, text: 'Már üres.' }] },
      { id: 'leave', kind: 'move', label: 'Kifelé', interaction: { verb: 'move', target: { kind: 'exit', id: 'leave' } }, moveTo: 'outside', message: 'Kiléptél.' },
    ] },
    outside: { title: 'Folyosó', description: 'Folyosó.', ...presentation.bindScene('outside'), exits: [{ id: 'return', label: 'Vissza' }], rules: [{ id: 'return', kind: 'move', label: 'Vissza', interaction: { verb: 'move', target: { kind: 'exit', id: 'return' } }, moveTo: 'sample', message: 'Visszatértél.' }] },
  } };
  const catalog = createCatalog([chapter]);
  let state: GameState = observeRoom({ version: 2, room: 'sample', inventory: [], flags: [], discoveries: [], journal: [], book: [], message: 'Próba.', turns: 0 }, catalog);
  const view = () => gameView({ state, revision: 0, updatedAt: 'now' }, catalog);
  assert.equal(view().scene.spots[0].glyph, '[ PAPER ]');
  assert.ok(!view().scene.art.includes('old artwork'));
  state = applyCommand(state, { verb: 'take', target: { kind: 'environment', id: 'tray' } }, catalog);
  const empty = () => { assert.equal(view().scene.spots[0].glyph, undefined); assert.ok(!view().scene.art.includes('old artwork')); assert.equal(view().scene.description, 'A pult üres.'); assert.deepEqual(view().inventory.map(item => item.id), ['paper']); };
  empty();
  state = applyCommand(state, { verb: 'look', target: { kind: 'environment', id: 'tray' } }, catalog);
  assert.equal(state.message, 'Már üres.'); empty();
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'leave' } }, catalog);
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'return' } }, catalog); empty();
  state = parseState(JSON.stringify(state), catalog); empty();
  chapter.scenes.sample.descriptionVariants![0].text = '';
  assert.throws(() => createCatalog([chapter]), /Érvénytelen állapotfüggő szöveg/);
});
