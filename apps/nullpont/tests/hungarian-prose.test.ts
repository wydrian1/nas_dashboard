import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CHAPTERS } from '../lib/game/catalog.ts';
import { initialState, parseState } from '../lib/game/engine.ts';

const prose = new Set(['label','description','descriptionVariants','message','messageVariants','notes','title','text','prompt','itemDescriptions','items','goals','milestone']);
function gameplay(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(gameplay);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,entry]) => [key,
    key === 'items' && !Array.isArray(entry) ? Object.keys(entry as object) :
    ['messageVariants','descriptionVariants','goals'].includes(key) ? gameplay(entry) :
    key === 'milestone' ? { id: (entry as {id:string}).id } :
    prose.has(key) ? undefined : gameplay(entry),
  ]).filter(([,entry]) => entry !== undefined));
}

test('Hungarian copy edit preserves the entire pre-edit gameplay catalog and illustration bytes', () => {
  // Captured on origin/main before the editorial pass and re-baselined when the
  // water-room service cover became an arrival-visible handler; the lock record
  // behind it stays gated on the float latch. IDs, conditions, variant order,
  // effects, input solutions, routes, geometry and artwork all remain covered.
  // Any further change to these gameplay bytes still fails this test.
  assert.equal(createHash('sha256').update(JSON.stringify(gameplay(CHAPTERS))).digest('hex'), 'd38c461197364293e8e938e56f80dcd6a04b49ec8b01c85cc3421e2ab54ecf9c');
});

test('loading a save never edits old Hungarian messages, journal notes or book pages', () => {
  const saved = { ...initialState(), message: 'Korábbi üzenet.', journal: ['Régi feljegyzés.'], book: [{id:'old-page',chapter:'I.',title:'Régi cím',text:'Régi, megőrzendő szöveg.',turn:0}] };
  assert.deepEqual(parseState(JSON.stringify(saved)), saved);
});
