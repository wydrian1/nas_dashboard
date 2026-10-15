import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyAction, applyCommand, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { createCatalog, CHAPTERS } from '../lib/game/catalog.ts';

function crafted() {
  let state = applyAction(initialState(), 'look:bed');
  state = applyAction(state, 'look:rim');
  state = applyAction(state, 'take:foil');
  state = applyCommand(state, { verb: 'back', levels: 2 });
  state = applyAction(state, 'look:panel');
  state = applyAction(state, 'take:wire');
  return applyAction(state, 'combine:foil:wire');
}
const contacts = { kind: 'environment' as const, id: 'awakening:panel-contacts' };
const panel = { kind: 'environment' as const, id: 'panel' };

test('crafted loop works on zoomed contacts with identical root-panel effects, persistence and repeat feedback', () => {
  const before = parseState(JSON.stringify(crafted()));
  const zoomed = applyCommand(before, { verb: 'use', item: 'bridge', target: contacts });
  const root = applyCommand(applyCommand(before, { verb: 'back' }), { verb: 'use', item: 'bridge', target: panel });
  assert.ok(zoomed.flags.includes('door-open'));
  assert.deepEqual(zoomed.inventory, ['bridge']);
  assert.deepEqual(zoomed.focus, before.focus);
  assert.equal(zoomed.room, 'chamber');
  assert.equal(zoomed.message, root.message);
  assert.deepEqual(zoomed.flags, root.flags);
  assert.deepEqual(zoomed.journal, root.journal);
  assert.deepEqual(zoomed.book.map(({ turn, ...entry }) => entry), root.book.map(({ turn, ...entry }) => entry));
  assert.deepEqual(zoomed.book.slice(0, -1), before.book);
  const reloaded = parseState(JSON.stringify(zoomed));
  assert.match(gameView({ state: reloaded, revision: 1, updatedAt: 'now' }).scene.description, /világítanak/);
  assert.match(applyCommand(reloaded, { verb: 'look', target: contacts }).message, /zár nyitva/);
  const repeated = applyCommand(reloaded, { verb: 'use', item: 'bridge', target: contacts });
  assert.match(repeated.message, /már nyitva/);
  assert.deepEqual(repeated.book, zoomed.book);
  assert.deepEqual(repeated.journal, zoomed.journal);
  const returned = applyCommand(repeated, { verb: 'back' });
  assert.match(gameView({ state: returned, revision: 1, updatedAt: 'now' }).scene.spots.find(spot => spot.id === 'door')!.glyph!, /NYITVA/);
  assert.deepEqual(applyCommand(returned, { verb: 'use', item: 'bridge', target: panel }).book, zoomed.book);
});

test('unfinished materials retain panel feedback on contacts without opening the door or consuming items', () => {
  for (const item of ['foil', 'wire']) {
    const root = { ...initialState(), inventory: [item] };
    const detail = applyAction(root, 'look:panel');
    const failed = applyCommand(detail, { verb: 'use', item, target: contacts });
    assert.equal(failed.message, applyCommand(root, { verb: 'use', item, target: panel }).message);
    assert.deepEqual(failed.inventory, detail.inventory);
    assert.deepEqual(failed.flags, detail.flags);
    assert.deepEqual(failed.book, detail.book);
    assert.ok(!failed.flags.includes('door-open'));
  }
});

test('close-up use cannot target hidden contacts or parent objects outside their visible scene', () => {
  const detail = crafted(), root = applyCommand(detail, { verb: 'back' });
  assert.throws(() => applyCommand(root, { verb: 'use', item: 'bridge', target: contacts }), /célpont/);
  assert.throws(() => applyCommand(detail, { verb: 'use', item: 'bridge', target: panel }), /célpont/);
  const elsewhere = applyAction(root, 'look:bed');
  assert.throws(() => applyAction(elsewhere, 'use:bridge:panel:contacts'), /nem érhető/);
});

test('alternative targets share an intentional milestone, while copied or cross-chapter IDs still reject', () => {
  const chapters = structuredClone(CHAPTERS);
  const root = chapters[0].scenes.chamber.rules.find(rule => rule.id === 'use:bridge:panel')!;
  const local = chapters[0].scenes['awakening:panel-detail'].rules.find(rule => rule.id === 'use:bridge:panel:contacts')!;
  assert.equal(root.milestone, local.milestone);
  assert.doesNotThrow(() => createCatalog(chapters));
  local.milestone = { ...root.milestone!, text: 'Conflicting history' };
  assert.throws(() => createCatalog(chapters), /Duplikált mérföldkő/);
  local.milestone = root.milestone;
  chapters[1].title = chapters[0].title;
  chapters[1].scenes[Object.keys(chapters[1].scenes)[0]].rules.push({ id: 'test:foreign-milestone', label: 'Test', kind: 'look', message: 'Test', milestone: root.milestone });
  assert.throws(() => createCatalog(chapters), /Duplikált mérföldkő/);
});

test('shared milestone ownership follows the connection author, not the host scene or display title', () => {
  const chapters = structuredClone(CHAPTERS);
  const milestone = chapters[0].scenes.chamber.rules.find(rule => rule.id === 'use:bridge:panel')!.milestone!;
  const foreignScene = Object.keys(chapters[1].scenes)[0];
  chapters[0].connections = [...chapters[0].connections ?? [], { from: foreignScene, rules: [{ id: 'test:own-connection', label: 'Test', kind: 'look', message: 'Test', milestone }] }];
  assert.doesNotThrow(() => createCatalog(chapters));
  chapters[1].title = chapters[0].title;
  chapters[1].connections = [...chapters[1].connections ?? [], { from: 'chamber', rules: [{ id: 'test:foreign-connection', label: 'Test', kind: 'look', message: 'Test', milestone }] }];
  assert.throws(() => createCatalog(chapters), /Duplikált mérföldkő/);
});

test('the opening history ID cannot be reused even by the opening chapter', () => {
  const chapters = structuredClone(CHAPTERS);
  chapters[0].scenes.chamber.rules.push({ id: 'test:reserved', label: 'Test', kind: 'look', message: 'Test', milestone: { id: 'awakening:wake', title: 'Test', text: 'Test' } });
  assert.throws(() => createCatalog(chapters), /Duplikált mérföldkő/);
});
