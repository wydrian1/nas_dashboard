import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CHAPTERS, createCatalog } from '../lib/game/catalog.ts';
import { awakening } from '../lib/game/chapters/awakening.ts';
import { gameView } from '../lib/game/view.ts';
import { initialState } from '../lib/game/engine.ts';
import { enterWing, openOriginal } from './helpers/awakening-route.ts';

test('authored ASCII target rectangles never overlap, including bridge and signal stairs', () => {
  for (const [id, scene] of Object.entries(CATALOG.scenes)) {
    const spots = scene.artSpots ?? [];
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i], b = spots[j];
      assert.ok(a.col + a.width <= b.col || b.col + b.width <= a.col || a.row + a.height <= b.row || b.row + b.height <= a.row, `${id}: ${a.id} overlaps ${b.id}`);
    }
  }
  const chapters = structuredClone(CHAPTERS);
  const targets = chapters.find(chapter => chapter.id === 'archive')!.scenes['archive:vestibule'].artSpots!;
  const stairs = targets.find(spot => spot.exit === 'archive:signals')!, bridge = targets.find(spot => spot.exit === 'archive:bridge')!;
  Object.assign(bridge, { row: stairs.row, col: stairs.col, width: stairs.width, height: stairs.height });
  delete bridge.glyph; delete bridge.glyphVariants;
  assert.throws(() => createCatalog(chapters), /Átfedő ASCII-célpontok/);
});

test('unspecified object actions default to examination, never meaningless take/talk/attack buttons', () => {
  const state = enterWing(openOriginal());
  const threshold = { ...state, room: 'threshold' };
  const rendered = gameView({ state: threshold, revision: 0, updatedAt: 'now' });
  assert.deepEqual(rendered.scene.spots.find(spot => spot.environment === 'awakening:departure-trace')!.actions, ['look']);
  const original = gameView({ state: initialState(), revision: 0, updatedAt: 'now' });
  assert.deepEqual(original.scene.spots.find(spot => spot.environment === 'speaker')!.actions, ['look', 'talk', 'attack'], 'deliberately authored alternatives stay available');
  const chapter = structuredClone(awakening);
  chapter.scenes.chamber.environment!.push({ id: 'compat-label', label: 'Felirat' });
  chapter.scenes.chamber.arrivalDiscoveries!.push('compat-label');
  delete chapter.scenes.chamber.artSpots;
  const catalog = createCatalog([chapter]);
  const compat = gameView({ state: initialState(), revision: 0, updatedAt: 'now' }, catalog);
  assert.deepEqual(compat.scene.spots.find(spot => spot.environment === 'compat-label')!.actions, ['look']);
});

test('location-scoped goals stay local, survive detail views, and reject unknown or detail-only rooms', () => {
  const chapter = structuredClone(awakening);
  chapter.goals = [{ text: 'Nézd meg az ajtót.', rooms: ['chamber'], requires: {} }];
  const catalog = createCatalog([chapter]);
  const view = (state: ReturnType<typeof initialState>) => gameView({ state, revision: 0, updatedAt: 'now' }, catalog);
  assert.equal(view(initialState()).goal, 'Nézd meg az ajtót.');
  assert.equal(view({ ...initialState(), focus: ['awakening:bed-detail'] }).goal, 'Nézd meg az ajtót.');
  assert.equal(view({ ...openOriginal(), room: 'threshold' }).goal, undefined);
  for (const rooms of [[], ['missing'], ['awakening:bed-detail'], ['chamber', 'chamber']]) {
    chapter.goals[0].rooms = rooms;
    assert.throws(() => createCatalog([chapter]), /Érvénytelen célhelyszín/);
  }
});
