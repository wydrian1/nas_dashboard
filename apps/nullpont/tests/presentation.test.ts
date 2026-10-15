import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import art from '../lib/game/presentation/art/scenes.json' with { type: 'json' };
import bindings from '../lib/game/presentation/bindings.json' with { type: 'json' };
import { bindScene, itemArt, itemArts, createPresentation, validatePresentation } from '../lib/game/presentation/index.ts';
import { CATALOG, CHAPTERS } from '../lib/game/catalog.ts';

function fixture() {
  return {
    art: { version: 1, scenes: { sample: { background: '............\n............\n............', handlers: [
      { id: 'h01', row: 0, col: 0, width: 3, height: 2, glyph: '[]', poses: { p01: '[*]' } },
      { id: 'h02', row: 0, col: 6, width: 3, height: 2 },
    ] } }, items: { sample: { glyph: '(o)' } } },
    bindings: { version: 1, scenes: { sample: [
      { handler: 'h01', id: 'sample:spot', environment: 'sample:object', actions: ['look'], variants: [{ requires: { flags: ['sample:changed'] }, pose: 'p01' }] },
      { handler: 'h02', id: 'sample:exit', exit: 'sample:exit' },
    ] } },
  };
}

test('all published scenes and inventory assemble through the presentation API', () => {
  validatePresentation(art, bindings);
  for (const chapter of CHAPTERS) {
    for (const [id, scene] of Object.entries(chapter.scenes)) {
      assert.deepEqual({ art: scene.art, artSpots: scene.artSpots }, bindScene(id));
      assert.ok(CATALOG.scenes[id]);
    }
    for (const [id, glyph] of Object.entries(chapter.itemArt ?? {})) assert.equal(itemArt(id), glyph);
    for (const connection of chapter.connections ?? []) assert.deepEqual(connection.artSpots, bindScene(`connection:${chapter.id}:entry`).artSpots);
  }
  assert.deepEqual(itemArts(['foil', 'wire']), { foil: itemArt('foil'), wire: itemArt('wire') });
  assert.equal(bindScene('awakening:water-room').artSpots.find(spot => spot.environment === 'awakening:vessels')!.glyphVariants!.length, 12);
  assert.equal(bindScene('relay:well-room').artSpots.find(spot => spot.environment === 'relay:alignment')!.glyphVariants!.length, 18);
  const vestibule = bindScene('archive:vestibule').artSpots;
  const bridge = vestibule.find(spot => spot.exit === 'archive:bridge')!, stairs = vestibule.find(spot => spot.exit === 'archive:signals')!;
  assert.ok(bridge.col + bridge.width <= stairs.col || stairs.col + stairs.width <= bridge.col || bridge.row + bridge.height <= stairs.row || stairs.row + stairs.height <= bridge.row);
});

test('artist handles are neutral and chapters contain no drawing implementations', () => {
  for (const scene of Object.values(art.scenes)) for (const handler of scene.handlers) {
    assert.match(handler.id, /^h\d+$/);
    if ('poses' in handler) for (const pose of Object.keys(handler.poses!)) assert.match(pose, /^p\d+$/);
  }
  for (const name of ['awakening', 'archive', 'relay']) {
    const source = readFileSync(new URL(`../lib/game/chapters/${name}.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(?:row|col|width|height|glyph|glyphVariants)\s*[:=]|\.artSpots!|function (?:drawing|picture|wingPicture|vessels|counterweightPicture)\b/);
  }
});

test('binding returns detached objects and preserves server-side pose requirements', () => {
  const f = fixture(), presentation = createPresentation(f.art, f.bindings);
  const first = presentation.bindScene('sample');
  assert.deepEqual(first.artSpots[0].glyphVariants, [{ requires: { flags: ['sample:changed'] }, text: '[*]' }]);
  first.artSpots[0].glyphVariants![0].requires.flags!.push('mutated');
  first.artSpots[0].actions!.push('take');
  f.art.scenes.sample.handlers[0].glyph = 'x';
  assert.deepEqual(presentation.bindScene('sample').artSpots[0].actions, ['look']);
  assert.deepEqual(presentation.bindScene('sample').artSpots[0].glyphVariants![0].requires.flags, ['sample:changed']);
  assert.equal(presentation.bindScene('sample').artSpots[0].glyph, '[]');
  assert.throws(() => presentation.bindScene('absent'), /unknown scene/);
  assert.throws(() => presentation.itemArt('absent'), /unknown item/);
});

for (const field of ['flags', 'actions', 'rules', 'environment', 'exit', 'requires', 'moveTo', 'recipe', 'unexpected']) {
  test(`artist JSON rejects gameplay/unknown field ${field} at every schema level`, () => {
    for (const level of ['root', 'scene', 'handler', 'item']) {
      const f = fixture();
      const target = level === 'root' ? f.art : level === 'scene' ? f.art.scenes.sample : level === 'handler' ? f.art.scenes.sample.handlers[0] : f.art.items.sample;
      Object.assign(target, { [field]: 'forbidden' });
      assert.throws(() => validatePresentation(f.art, f.bindings), /unknown field/);
    }
  });
}

const invalidCases: [string, (f: ReturnType<typeof fixture>) => void, RegExp][] = [
  ['unsupported version', f => { f.art.version = 2; }, /unsupported version/],
  ['missing binding scene', f => { delete (f.bindings.scenes as Partial<typeof f.bindings.scenes>).sample; }, /missing binding scene/],
  ['extra binding scene', f => { Object.assign(f.bindings.scenes, { extra: [] }); }, /extra binding scene/],
  ['missing handler binding', f => { f.bindings.scenes.sample.pop(); }, /missing handler binding/],
  ['extra handler binding', f => { f.bindings.scenes.sample[1].handler = 'absent'; }, /unknown handler/],
  ['extra art handler', f => { f.art.scenes.sample.handlers.push({ id: 'h03', row: 2, col: 10, width: 1, height: 1 }); }, /missing handler binding/],
  ['duplicate handler', f => { f.art.scenes.sample.handlers[1].id = 'h01'; }, /duplicate/],
  ['duplicate binding', f => { f.bindings.scenes.sample.push(structuredClone(f.bindings.scenes.sample[0])); }, /duplicate/],
  ['duplicate spot ID', f => { f.bindings.scenes.sample[1].id = 'sample:spot'; }, /duplicate/],
  ['missing pose', f => { f.bindings.scenes.sample[0].variants![0].pose = 'absent'; }, /unknown pose/],
  ['unbound pose', f => { f.art.scenes.sample.handlers[0].poses = { p01: '[*]', ...{ p02: '[-]' } }; }, /missing pose binding/],
  ['duplicate pose binding', f => { f.bindings.scenes.sample[0].variants!.push(structuredClone(f.bindings.scenes.sample[0].variants![0])); }, /duplicate/],
  ['non-ASCII background', f => { f.art.scenes.sample.background = 'é'; }, /ASCII/],
  ['oversized background width', f => { f.art.scenes.sample.background = 'x'.repeat(161); }, /oversized/],
  ['oversized background height', f => { f.art.scenes.sample.background = ('x\n').repeat(80); }, /oversized/],
  ['non-ASCII glyph', f => { f.art.scenes.sample.handlers[0].glyph = 'é'; }, /ASCII/],
  ['oversized glyph', f => { f.art.scenes.sample.handlers[0].glyph = 'xxxx'; }, /oversized/],
  ['oversized pose', f => { f.art.scenes.sample.handlers[0].poses!.p01 = 'xxxx'; }, /oversized/],
  ['non-ASCII pose', f => { f.art.scenes.sample.handlers[0].poses!.p01 = '\t'; }, /ASCII/],
  ['non-ASCII item', f => { f.art.items.sample.glyph = 'é'; }, /ASCII/],
  ['oversized item', f => { f.art.items.sample.glyph = 'x'.repeat(161); }, /oversized/],
  ['item wider than sidebar budget', f => { f.art.items.sample.glyph = 'x'.repeat(19); }, /oversized/],
  ['item taller than inventory budget', f => { f.art.items.sample.glyph = Array(10).fill('x').join('\n'); }, /oversized/],
  ['empty inventory drawing', f => { f.art.items.sample.glyph = '   \n   '; }, /empty inventory glyph/],
  ['negative geometry', f => { f.art.scenes.sample.handlers[0].row = -1; }, /invalid row/],
  ['fractional geometry', f => { f.art.scenes.sample.handlers[0].col = 0.5; }, /invalid col/],
  ['empty rectangle', f => { f.art.scenes.sample.handlers[0].width = 0; }, /invalid width/],
  ['out-of-bounds row', f => { f.art.scenes.sample.handlers[0].row = 2; }, /out-of-bounds/],
  ['out-of-bounds column', f => { f.art.scenes.sample.handlers[0].col = 11; }, /out-of-bounds/],
  ['overlap', f => { f.art.scenes.sample.handlers[1].col = 2; }, /overlapping/],
  ['unknown generic action', f => { f.bindings.scenes.sample[0].actions = ['solve']; }, /unknown generic action/],
  ['unknown requirement field', f => { Object.assign(f.bindings.scenes.sample[0].variants![0].requires, { rules: [] }); }, /unknown field/],
];
for (const [name, mutate, error] of invalidCases) test(`presentation rejects ${name}`, () => {
  const f = fixture(); mutate(f);
  assert.throws(() => validatePresentation(f.art, f.bindings), error);
});
