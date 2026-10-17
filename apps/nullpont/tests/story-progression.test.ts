import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAPTERS, CATALOG } from '../lib/game/catalog.ts';
import { OPENING_ENTRY } from '../lib/game/chapters/awakening.ts';
import { applyCommand, initialState, observeRoom, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { aw, closeAwakening, enterWing, go, openOriginal, solveWater } from './helpers/awakening-route.ts';
import type { GameState, PlayerCommand } from '../lib/game/types.ts';

const act = (state: GameState, verb: PlayerCommand['verb'], target: string, input?: string, item?: string) => applyCommand(state, { verb, target: { kind: verb === 'move' ? 'exit' : 'environment', id: target }, ...(input === undefined ? {} : { input }), ...(item ? { item } : {}) });
const reload = (state: GameState) => parseState(JSON.stringify(state));
const view = (state: GameState) => gameView({ state, revision: 0, updatedAt: 'now' });
const glyph = (state: GameState, target: string) => view(state).scene.spots.find(spot => spot.environment === target)?.glyph ?? '';
function records(state: GameState) {
  state = act(state, 'move', 'archive:entry');
  state = act(state, 'submit', 'archive:reader', '427');
  return act(state, 'move', 'archive:records');
}
function dispatch(state: GameState) {
  state = act(state, 'move', 'relay:entry');
  state = act(state, 'move', 'relay:interval');
  for (const [verb, target] of [['use', 'single'], ['use', 'double'], ['look', 'rest']] as const) state = act(state, verb, 'relay:' + target);
  state = act(state, 'move', 'relay:well');
  for (const wheel of ['left-wheel', 'left-wheel', 'right-wheel']) state = act(state, 'use', 'relay:' + wheel);
  state = act(state, 'look', 'relay:alignment');
  return act(state, 'move', 'relay:dispatch');
}
function receiver(state: GameState) {
  state = act(state, 'submit', 'relay:missing-tray', '09');
  return act(state, 'move', 'relay:receiver');
}
test('a picked-up plate left in the reader never respawns on return or reload, including legacy saves', () => {
  let state=records(closeAwakening(openOriginal()));
  state=act(state,'move','archive:records-return');
  for(const target of ['archive:board','archive:margin','archive:pencil']) state=act(state,'look',target);
  state=act(state,'take','archive:loose-witness');
  assert.ok(state.flags.includes('archive:witness-taken'));
  state=applyCommand(applyCommand(state,{verb:'back'}),{verb:'back'});
  state=act(state,'move','archive:records');
  state=receiver(dispatch(state));
  state=act(state,'use','relay:card-reader',undefined,'archive:witness');
  assert.ok(!state.inventory.includes('archive:witness'));
  for(const exit of ['relay:receiver-back','relay:dispatch-back','relay:well-back','relay:interval-back','relay:gallery-back','archive:records-return']) state=act(state,'move',exit);
  for(const legacy of [false,true]) {
    let returned=reload(legacy?{...state,flags:state.flags.filter(flag=>flag!=='archive:witness-taken')}:state);
    for(const target of ['archive:board','archive:margin','archive:pencil']) returned=act(returned,'look',target);
    assert.match(view(returned).scene.description,/üres a lemez helye/);
    assert.match(returned.message,/üres bemetszés/);
    assert.ok(!view(returned).environment.some(entity=>entity.id==='archive:loose-witness'));
    assert.throws(()=>act(returned,'take','archive:loose-witness'),/nem érhető el/);
    assert.ok(!returned.inventory.includes('archive:witness'));
    assert.deepEqual(reload(returned).inventory,returned.inventory);
  }
});
test('minimum route yields three bounded answers without optional dialogue, directory, signal puzzle or frame craft', () => {
  const start = openOriginal();
  let state = closeAwakening(start, { craft: false });
  assert.ok(!state.flags.includes('voice-heard'));
  assert.ok(!state.flags.includes(aw('viewer-made')));
  const log = state.book.find(entry => entry.id === aw('lock-record-read'))!;
  assert.match(log.text, /nyolc.*belső kézi/i);
  assert.match(log.text, /nem lett ettől önkéntes/);
  state = records(state);
  assert.match(state.message, /közös csomópont.*nem kell két beszélőnek lennie/);
  assert.ok(state.book.some(entry => entry.id === 'archive:shared-source-heard'));
  assert.ok(!state.book.some(entry => ['archive:addresses-read', 'archive:signal-read'].includes(entry.id)));
  state = dispatch(state);
  assert.match(state.message, /E-09\/1.*BELSŐ ZÁR: VÁLTOZATLAN/);
  assert.ok(state.book.some(entry => entry.id === 'relay:execution-read'));
  state = receiver(state);
  assert.match(state.message, /ÉBRESZTÉS ENGEDÉLYEZVE.*Bezárásra vagy emléktörlésre ez a kivonat nem ad felhatalmazást/);
  assert.ok(state.book.some(entry => entry.id === 'relay:permit-read'));
  assert.ok(!state.inventory.includes('archive:witness'));
  assert.deepEqual(state.book.slice(0, start.book.length), start.book);
  assert.deepEqual(reload(state), state);
});

test('plain, reserved and legacy no-choice receive different physical reactions without changing evidence access', () => {
  for (const choice of ['plain', 'reserved', 'legacy']) {
    let state = choice === 'legacy' ? { ...openOriginal(), flags: ['door-open', aw('chapter-closed')] } : closeAwakening(openOriginal(), { reserved: choice === 'reserved' });
    state = records(state);
    state = act(state, 'look', 'archive:accompanying-copy');
    const expected = choice === 'reserved' ? /FENNTARTÁS CSATOLVA/ : choice === 'plain' ? /JELENLEGI TOVÁBBHALADÁS/ : /MEGJEGYZÉS NINCS CSATOLVA/;
    const expectedArt = choice === 'reserved' ? /FENNTARTAS CSATOLVA/ : choice === 'plain' ? /JELENLEGI TOVABBHALADAS/ : /MEGJEGYZES NINCS CSATOLVA/;
    assert.match(state.message, expected);
    assert.match(view(reload(state)).scene.description, expected);
    assert.match(glyph(state, 'archive:accompanying-copy'), expectedArt);
    assert.match(state.message, /RÉGI HOZZÁJÁRULÁS rovata üres/);
    const recordState = state;
    state = act(act(state, 'move', 'archive:records-return'), 'move', 'archive:signals');
    state = applyCommand(state, { verb: 'talk', target: { kind: 'environment', id: 'archive:tube' }, topic: 'archive:tube-copy' });
    assert.match(state.message, choice === 'reserved' ? /Megjött a lapod a sínen.*megjegyzésedet külön másoltam/ : choice === 'plain' ? /Megjött a lapod.*továbbmész/ : /nem érkezett kilépési megjegyzés/);
    state = receiver(dispatch(recordState));
    assert.ok(state.flags.includes('relay:permit-read'));
    state = act(state, 'look', 'relay:accompanying-copy');
    assert.match(state.message, expected);
    assert.match(view(reload(state)).scene.description, expected);
    assert.match(glyph(state, 'relay:accompanying-copy'), expectedArt);
    assert.equal(state.flags.filter(flag => flag === aw('departure-plain') || flag === aw('departure-reserved')).length, choice === 'legacy' ? 0 : 1);
  }
});

test('the separate monitor experiment is reversible and cannot operate the old paper-language puzzle', () => {
  let state = records(closeAwakening(openOriginal()));
  state = act(act(state, 'move', 'archive:records-return'), 'move', 'archive:signals');
  const oldFlags = state.flags.filter(flag => /route-bridge|ground-outer/.test(flag)), inventory = [...state.inventory];
  const beforeArt = glyph(state, 'archive:monitor-switch');
  state = act(state, 'use', 'archive:monitor-switch');
  assert.match(state.message, /BELÜL 09.*elnémul.*FOLYOSÓ 90.*tovább/);
  assert.notEqual(glyph(state, 'archive:monitor-switch'), beforeArt);
  assert.deepEqual(state.flags.filter(flag => /route-bridge|ground-outer/.test(flag)), oldFlags);
  state = act(act(state, 'move', 'archive:signals-return'), 'move', 'archive:records');
  assert.match(view(reload(state)).scene.description, /BELÜL 09.*néma.*FOLYOSÓ 90.*tovább/);
  state = act(act(state, 'move', 'archive:records-return'), 'move', 'archive:signals');
  state = act(reload(state), 'use', 'archive:monitor-switch');
  assert.equal(glyph(state, 'archive:monitor-switch'), beforeArt);
  assert.deepEqual(state.inventory, inventory);
  assert.equal(state.book.filter(entry => entry.id === 'archive:monitor-tested').length, 1);
});

test('the optional witness pays off at a separate reader, stays in its socket, and leaves a persistent printed result', () => {
  let state = receiver(dispatch(records(closeAwakening(openOriginal()))));
  state = { ...state, inventory: [...state.inventory, 'archive:witness'] };
  const book = [...state.book], emptyArt = glyph(state, 'relay:card-reader');
  state = act(state, 'use', 'relay:tube-mouth', undefined, 'archive:witness');
  assert.match(state.message, /hiányzik a foglalat/);
  assert.deepEqual(state.book, book);
  state = act(state, 'use', 'relay:card-reader', undefined, 'archive:witness');
  assert.match(state.message, /E-09\/1.*CSAK KIVONAT ADHATÓ KI/);
  assert.ok(!state.inventory.includes('archive:witness'), 'the plate stays in the reader socket');
  assert.notEqual(glyph(state, 'relay:card-reader'), emptyArt);
  for (let i = 0; i < 3; i++) state = reload(state);
  assert.equal(state.book.filter(entry => entry.id === 'relay:witness-read').length, 1);
  assert.match(view(state).scene.description, /foglalatában ott a lemez.*ÁTVÉTEL \/ E-09\/1/);
  assert.doesNotMatch(view(state).scene.description, /kimeneti rése üres/);
  assert.ok(!reload(state).inventory.includes('archive:witness'));
  state = receiver(act(state, 'move', 'relay:receiver-back'));
  assert.match(glyph(reload(state), 'relay:card-reader'), /E-09\/1/);
});

test('a save that read the plate before the plate stayed behind keeps an honest taken-back wording in scene and reader', () => {
  const legacy = observeRoom({ ...initialState(), room: 'relay:receiver-room', flags: ['door-open', 'relay:request-sent', 'relay:received', 'relay:witness-read'], inventory: ['archive:witness'] });
  const description = view(legacy).scene.description;
  assert.match(description, /foglalata üres; a lemezt visszavetted/);
  assert.match(description, /ÁTVÉTEL \/ E-09\/1/);
  assert.doesNotMatch(description, /foglalatában ott a lemez/);
  const looked = act(legacy, 'look', 'relay:card-reader');
  assert.match(looked.message, /foglalata üres; a lemezt visszavetted/);
  assert.match(looked.message, /E-09\/1/);
  assert.doesNotMatch(looked.message, /foglalatában ott a lemez/);
  const reopened = reload(legacy);
  assert.deepEqual(reopened.inventory, ['archive:witness']);
  assert.equal(view(reopened).scene.description, description, 'reloading an old save changes nothing');
  assert.equal(reopened.book.length, legacy.book.length, 'an old save gains no retrospective page');
});

test('old advanced room/focus saves gain no retrospective evidence, turns, flags or rewritten history on load', () => {
  for (const [room, flags] of [
    [aw('source-room'), ['door-open', aw('flow-latched'), aw('sources-accepted')]],
    ['archive:record-room', ['door-open', 'archive:records-open']],
    ['relay:well-room', ['door-open', 'relay:lift-ready']],
    ['relay:dispatch-room', ['door-open', 'relay:lift-ready', 'relay:request-sent']],
    ['relay:receiver-room', ['door-open', 'relay:request-sent', 'relay:received']],
  ] as const) {
    const legacy = { ...initialState(), room, flags: [...flags] };
    const loaded = reload(legacy);
    for (const field of ['book', 'journal', 'turns', 'message', 'flags', 'inventory'] as const) assert.deepEqual(loaded[field], legacy[field]);
    assert.deepEqual(reload(loaded), loaded);
    const target = room === aw('source-room') ? aw('lock-rubbing') : room === 'archive:record-room' ? 'archive:monitors' : room === 'relay:well-room' ? 'relay:service-holder' : room === 'relay:dispatch-room' ? 'relay:execution-copy' : 'relay:permit-copy';
    const inspected = act(loaded, 'look', target);
    assert.ok(inspected.message.length > 80);
    assert.deepEqual(inspected.book.slice(0, loaded.book.length), loaded.book);
  }
  const focused = reload({ ...openOriginal(), room: 'archive:vestibule', focus: ['archive:directory', 'archive:paper-fold'] });
  assert.equal(view(focused).scene.id, 'archive:paper-fold');
  assert.ok(!focused.flags.includes('archive:shared-source-heard'));
});

test('new evidence objects appear in the right physical state without respawning old pickups', () => {
  let state = go(enterWing(), 'water');
  assert.ok(!view(state).environment.some(entity => entity.id === aw('lock-record')));
  state = solveWater(state);
  assert.match(glyph(state, aw('lock-record')), /ZARJEGYZEK/);
  assert.match(act(reload(state), 'look', aw('lock-record')).message, /BELSŐ KÉZI.*KÜLSŐ ÉBRESZTÉS/);
  for (const scene of Object.values(CATALOG.scenes)) for (const entity of scene.environment ?? []) assert.ok(scene.artSpots?.some(spot => spot.environment === entity.id), entity.id);
  const publicOpening = JSON.stringify(view(initialState()));
  assert.doesNotMatch(publicOpening, /E-09\/1|monitor-isolated|lock-record-read|permit-read/);
});

test('all previously published book pages remain byte-identical after the authorized language edit', () => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/published-story-79f64ea.json', import.meta.url), 'utf8'));
  const current: Record<string, unknown> = { [OPENING_ENTRY.id]: OPENING_ENTRY };
  for (const chapter of CHAPTERS) for (const scene of [...Object.values(chapter.scenes), ...(chapter.connections ?? [])]) for (const rule of scene.rules) if (rule.milestone) current[rule.milestone.id] = rule.milestone;
  for (const [id, entry] of Object.entries(baseline.milestones)) assert.deepEqual(current[id], entry, id);
  // The owner authorized editing live opening prose. Gameplay is separately
  // pinned by hungarian-prose.test.ts; saved historical pages stay immutable.
});

test('isolating before the first records visit never invents a two-grille comparison, including legacy saves', () => {
  let state = act(closeAwakening(openOriginal()), 'move', 'archive:entry');
  state = act(state, 'move', 'archive:signals');
  state = act(state, 'use', 'archive:monitor-switch');
  state = act(state, 'move', 'archive:signals-return');
  state = act(state, 'submit', 'archive:reader', '427');
  state = act(state, 'move', 'archive:records');
  const legacy = observeRoom({ ...initialState(), room: 'archive:record-room', flags: ['door-open', 'archive:records-open', 'archive:monitor-isolated'] });
  for (let branch of [state, legacy]) {
    for (let repeat = 0; repeat < 3; repeat++) branch = act(reload(branch), 'look', 'archive:monitors');
    assert.ok(!branch.flags.includes('archive:shared-source-heard'));
    assert.ok(!branch.book.some(page => page.id === 'archive:shared-source-heard'));
    const quiet = branch.book.filter(page => page.id === 'archive:isolated-source-seen');
    assert.equal(quiet.length, 1);
    assert.match(quiet[0].text, /egyik lehallgatórács néma volt/);
    assert.match(quiet[0].text, /nem hasonlíthattam össze/);
    branch = act(act(branch, 'move', 'archive:records-return'), 'move', 'archive:signals');
    branch = act(branch, 'use', 'archive:monitor-switch');
    branch = act(act(branch, 'move', 'archive:signals-return'), 'move', 'archive:records');
    for (let repeat = 0; repeat < 3; repeat++) branch = act(reload(branch), 'look', 'archive:monitors');
    const compared = branch.book.filter(page => page.id === 'archive:shared-source-heard');
    assert.equal(compared.length, 1);
    assert.match(compared[0].text, /két lehallgatórácsából ugyanazt.*hallottam/);
    assert.deepEqual(branch.book.find(page => page.id === quiet[0].id), quiet[0]);
  }
});

test('permit-first, execution-first and witness-first legacy routes keep every new book page within its actual evidence', () => {
  const executionId = 'relay:execution-read', permitId = 'relay:permit-read', witnessId = 'relay:witness-read';
  const legacy = observeRoom({ ...initialState(), room: 'relay:receiver-room', flags: ['door-open', 'relay:request-sent', 'relay:received'], inventory: ['archive:witness'] });
  assert.deepEqual(reload(legacy).book, initialState().book);
  const originalBook = structuredClone(legacy.book);
  for (const order of [['permit', 'execution', 'witness'], ['execution', 'permit', 'witness'], ['witness', 'permit', 'execution']]) {
    let state = reload(legacy);
    for (const evidence of order) {
      if (evidence === 'execution') {
        state = act(state, 'move', 'relay:receiver-back');
        for (let repeat = 0; repeat < 3; repeat++) state = act(reload(state), 'look', 'relay:execution-copy');
        const text = state.book.find(page => page.id === executionId)!.text;
        assert.match(text, /Maga a végrehajtási lap nem idézte az engedélyt/);
        assert.doesNotMatch(text, /engedélyből még nem olvastam/);
        state = act(state, 'move', 'relay:receiver');
      } else if (evidence === 'permit') {
        for (let repeat = 0; repeat < 3; repeat++) state = act(reload(state), 'look', 'relay:permit-copy');
        const text = state.book.find(page => page.id === permitId)!.text;
        assert.match(text, /E-09\/1.*helyi irathivatkozásként/);
        assert.doesNotMatch(text, /ugyanaz.*végrehajtási|mint a szerviz/);
        assert.doesNotMatch(state.message, /azonos a szerviz/);
      } else {
        state = act(reload(state), 'use', 'relay:card-reader', undefined, 'archive:witness');
        assert.match(state.message, /engedélykivonat itt.*végrehajtási másolat pedig a küldeményfülkénél/);
        assert.ok(!state.inventory.includes('archive:witness'), 'the plate stays in the reader socket');
        for (let repeat = 0; repeat < 3; repeat++) state = reload(state);
        assert.match(view(state).scene.description, /foglalatában ott a lemez/);
        const text = state.book.find(page => page.id === witnessId)!.text;
        assert.match(text, /csík maga nevezte meg/);
        assert.doesNotMatch(text, /ugyanarra.*mint a papírok|pulton fekvő helyi lapok/);
      }
    }
    for (const id of [executionId, permitId, witnessId]) assert.equal(state.book.filter(page => page.id === id).length, 1);
    assert.deepEqual(state.book.slice(0, originalBook.length), originalBook);
    assert.ok(!state.inventory.includes('archive:witness'), 'the plate stays in the reader socket');
    assert.deepEqual(reload(state), state);
  }
});
