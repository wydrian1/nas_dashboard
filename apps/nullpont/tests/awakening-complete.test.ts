import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CHAPTERS, meets } from '../lib/game/catalog.ts';
import { awakening } from '../lib/game/chapters/awakening.ts';
import { applyAction, applyCommand, initialState, observeRoom, parseState } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { aw, go, use, look, take, reload, openOriginal, enterWing, solveWater, solveLight, solveSources, closeAwakening } from './helpers/awakening-route.ts';
import type { GameState } from '../lib/game/types.ts';

const view = (state: GameState) => gameView({ state, revision: 2, updatedAt: 'now' });
const physical = ['cloakroom', 'water-room', 'light-room', 'source-room', 'decision-room'].map(aw);
const at = (room: string, flags: string[] = [], inventory: string[] = []) => observeRoom({ ...initialState(), room, flags: ['door-open', ...flags], inventory });
const glyph = (state: GameState, name: string) => view(state).scene.spots.find(spot => spot.environment === aw(name))?.glyph ?? '';
const volume = (state: GameState, prefix: string, max: number) => Array.from({ length: max }, (_, i) => i + 1).find(i => state.flags.includes(aw(`${prefix}-${i}`))) ?? 0;
const controlKey = (state: GameState) => JSON.stringify(state.flags.filter(flag => flag.startsWith('awakening:')).sort());

test('the existing water diagram is readable before any failed attempt, at every saved volume', () => {
  for (let large=0;large<=3;large++) for (let small=0;small<=2;small++) for (const latched of [false,true]) {
    const flags=[...(large?[aw(`large-${large}`)]:[]),...(small?[aw(`small-${small}`)]:[]),...(latched?[aw('flow-latched')]:[])];
    const state=at(aw('water-room'),flags);
    for (const saved of [state,reload(state)]) {
      assert.match(view(saved).scene.description,/KÉT EGYSÉG TERHELÉS/);
      const examined=look(saved,'vessels');
      assert.match(examined.message,/második rovátkájánál/);
      assert.match(examined.message,/ÜRES VISSZATÉRŐ/);
      assert.deepEqual(examined.flags,saved.flags);
    }
  }
});

test('readable corridor numbers are accessible and every closed door offers its existing knock action', () => {
  const state=observeRoom({...initialState(),room:'threshold',flags:['door-open'],focus:[aw('corridor-doors')]});
  const rendered=view(state);
  assert.match(rendered.environment.find(entity=>entity.id===aw('hall-door-left-middle'))!.label,/80/);
  assert.match(rendered.environment.find(entity=>entity.id===aw('hall-door-right-middle'))!.label,/70/);
  for(const spot of rendered.scene.spots.filter(spot=>spot.environment?.startsWith(aw('hall-door-')))) {
    assert.ok(spot.actions.includes('talk'));
    const next=applyCommand(state,{verb:'talk',target:{kind:'environment',id:spot.environment!}});
    assert.notEqual(next.message,state.message);
    assert.equal(next.room,state.room);
    assert.deepEqual(next.inventory,state.inventory);
    assert.deepEqual(next.book,state.book);
  }
});

test('exactly five new physical locations complete awakening before archive, without a story ending or new chapter ID', () => {
  assert.equal(Object.values(awakening.scenes).filter(scene => !scene.detailOf).length, 7);
  assert.deepEqual(CHAPTERS.map(chapter => chapter.id), ['awakening', 'archive', 'relay']);
  for (const id of physical) assert.equal(awakening.scenes[id].detailOf, undefined);
  const escaped = openOriginal(), before = structuredClone(escaped.book);
  assert.equal(applyCommand(escaped, { verb: 'move', target: { kind: 'exit', id: 'archive:entry' } }).room, 'threshold');
  assert.throws(() => go(escaped, 'wing-entry'), /célpont/);
  const complete = closeAwakening(escaped, { craft: true, reloads: true });
  assert.equal(complete.room, 'threshold'); assert.ok(complete.flags.includes(aw('chapter-closed')));
  assert.deepEqual(complete.book.slice(0, before.length), before);
  assert.ok(complete.book.filter(entry => entry.id.startsWith('awakening:')).every(entry => entry.chapter === 'I. Az ébredés'));
  assert.match(complete.book.at(-1)!.text, /Az archívumban akartam utánajárni/);
  assert.doesNotMatch(complete.book.at(-1)!.text, /holnapi|archivista|emlékeim visszatértek/);
  assert.equal(applyCommand(complete, { verb: 'move', target: { kind: 'exit', id: 'archive:entry' } }).room, 'archive:vestibule');
  assert.ok(complete.inventory.includes('bridge'));
});

test('whole first-chapter route matrix: pickup order, craft direction, panel target, dialogue, branch order, optical route and both deliberate closures', () => {
  let routes = 0;
  for (const wireFirst of [false, true]) for (const reverseCraft of [false, true]) for (const closeup of [false, true]) for (const dialogue of [0, 1, 2, 3]) for (const lightFirst of [false, true]) for (const craft of [false, true]) for (const reserved of [false, true]) {
    const opening = openOriginal({ wireFirst, reverseCraft, closeup, dialogue });
    const complete = closeAwakening(opening, { lightFirst, craft, reserved, reverseCraft, reloads: true });
    assert.ok(complete.flags.includes(aw(reserved ? 'departure-reserved' : 'departure-plain')));
    assert.equal(complete.book.filter(entry => entry.id.startsWith(aw('closure-'))).length, 1);
    assert.ok(complete.inventory.includes(aw(craft ? 'viewer' : 'prism')));
    assert.ok(!complete.inventory.includes(aw('source-card')), 'the source legend is spent on the pins');
    assert.ok(complete.inventory.includes('bridge'));
    assert.deepEqual(complete.book.slice(0, opening.book.length), opening.book);
    assert.deepEqual(reload(complete), complete); routes++;
  }
  assert.equal(routes, 256);
});

test('fluid state graph: every reachable setting and every one of the 12 bounded volumes can recover; latched access never relocks', () => {
  const controls = ['fill', 'empty-large', 'empty-small', 'pour-small', 'pour-large', 'float-test'];
  const start = go(enterWing(), 'water'), queue = [start], seen = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index], key = controlKey(state); if (seen.has(key)) continue; seen.add(key);
    assert.deepEqual(reload(state), state);
    assert.equal(go(state, 'water-back').room, aw('cloakroom'));
    assert.ok(solveWater(state).flags.includes(aw('flow-latched')));
    for (const name of controls) {
      const next = use(state, name);
      assert.ok(volume(next, 'large', 3) <= 3 && volume(next, 'small', 2) <= 2);
      assert.deepEqual(next.inventory, state.inventory);
      if (state.flags.includes(aw('flow-latched'))) assert.ok(next.flags.includes(aw('flow-latched')));
      if (!seen.has(controlKey(next))) queue.push(next);
    }
    assert.ok(seen.size <= 24);
  }
  assert.equal(seen.size, 20, '10 actually reachable volume pairs before and after latching');
  for (let large = 0; large <= 3; large++) for (let small = 0; small <= 2; small++) {
    const state = at(aw('water-room'), [...(large ? [aw(`large-${large}`)] : []), ...(small ? [aw(`small-${small}`)] : [])]);
    const result = use(state, 'float-test'); assert.equal(result.flags.includes(aw('flow-latched')), large === 2 && small === 0);
    assert.ok(solveWater(state).flags.includes(aw('flow-latched')));
    assert.match(view(state).scene.description, new RegExp(`üveghengerben ${large}, a rövidben ${small}`));
    assert.equal(glyph(reload(state), 'vessels'), glyph(state, 'vessels'));
    const poured = use(state, 'pour-small'); assert.equal(volume(poured, 'large', 3) + volume(poured, 'small', 2), large + small, 'transfer conserves water');
  }
});

test('all six light/shutter configurations, both optical tools, wrong-item attempts and post-read relighting preserve fair recovery', () => {
  for (let angle = 0; angle < 3; angle++) for (const open of [false, true]) for (const item of ['prism', 'viewer']) {
    let state = at(aw('light-room'), [...(angle ? [aw(`angle-${angle}`)] : []), ...(open ? [aw('shutter-open')] : [])], [aw(item), 'bridge']);
    const attempted = use(state, 'relief', aw(item)); assert.equal(attempted.flags.includes(aw('relief-read')), angle === 2 && open);
    assert.deepEqual(attempted.inventory, state.inventory);
    const reflected = use(state, 'relief', 'bridge');
    assert.equal(reflected.flags.includes(aw('relief-read')), angle === 2 && open, 'the foil on the bridge can also guide sideways light');
    assert.deepEqual(reflected.inventory, state.inventory);
    assert.deepEqual(use({ ...state, inventory: [...state.inventory, 'wire'] }, 'relief', 'wire').flags, state.flags);
    state = solveLight(state, aw(item)); assert.ok(state.flags.includes(aw('relief-read')));
    assert.match(state.message, /SZEMLE.*KÖZLÉS.*HIÁNY/);
    state = take(state, 'loose-source-card'); const book = structuredClone(state.book);
    state = use(use(state, 'shutter'), 'lamp'); state = use(reload(state), 'relief', aw(item));
    assert.deepEqual(state.book, book); assert.ok(!view(state).environment.some(entity => entity.id === aw('loose-source-card')));
    assert.equal(go(state, 'light-back').room, aw('cloakroom'));
  }
});

test('27 source assignments before and after acceptance: exact evidence classes, card gate, failed attempts and latched return access', () => {
  for (const accepted of [false, true]) for (let wrist = 0; wrist < 3; wrist++) for (let claim = 0; claim < 3; claim++) for (let name = 0; name < 3; name++) {
    const flags = [aw('flow-latched'), aw('card-registered'), ...(accepted ? [aw('sources-accepted')] : []), ...[['wrist-source', wrist], ['claim-source', claim], ['name-source', name]].flatMap(([field, position]) => position ? [aw(`${field}-${position}`)] : [])];
    let state = at(aw('source-room'), flags, [aw('source-card')]);
    const result = use(state, 'source-check'); assert.equal(result.flags.includes(aw('sources-accepted')), accepted || (wrist === 1 && claim === 2 && name === 0));
    assert.deepEqual(result.inventory, state.inventory);
    state = solveSources(state); assert.ok(state.flags.includes(aw('sources-accepted')));
    assert.equal(go(reload(state), 'decision').room, aw('decision-room'));
    assert.equal(go(state, 'source-back').room, aw('cloakroom'));
    assert.match(glyph(state, 'wrist-source'), /SZEMLE/); assert.match(glyph(state, 'claim-source'), /KOZLES/); assert.match(glyph(state, 'name-source'), /HIANY/);
  }
  const unregistered = at(aw('source-room'), [aw('flow-latched')]);
  assert.deepEqual(use(unregistered, 'wrist-source').flags, unregistered.flags);
  assert.deepEqual(use(unregistered, 'source-check').flags, unregistered.flags);
  assert.equal(go(unregistered, 'decision').room, aw('source-room'));
});

test('exploring both final declarations or leaving does not consent; explicit choice is recorded once with no item loss', () => {
  for (const selected of ['departure-plain', 'departure-reserved']) {
    let state = at(aw('decision-room'), [aw('flow-latched'), aw('sources-accepted')], ['bridge', aw('viewer'), aw('source-card')]);
    const inventory = [...state.inventory], book = structuredClone(state.book);
    for (const name of ['departure-plain', 'departure-reserved', 'departure-copy']) state = look(state, name);
    assert.ok(!state.flags.includes(aw('chapter-closed'))); assert.deepEqual(state.book, book);
    const unrecordedReturn = go(reload(state), 'departure-return');
    assert.equal(unrecordedReturn.room, 'threshold'); assert.match(unrecordedReturn.message, /átjáró még zárva.*kijárati pultnál kérhetsz hozzáférést/);
    assert.equal(applyCommand(unrecordedReturn, { verb: 'move', target: { kind: 'exit', id: 'archive:entry' } }).room, 'threshold');
    assert.equal(go(state, 'decision-back').room, aw('source-room'));
    state = use(state, selected); const recorded = structuredClone(state.book);
    for (let repeat = 0; repeat < 3; repeat++) for (const name of ['departure-plain', 'departure-reserved']) state = use(reload(state), name);
    assert.deepEqual(state.book, recorded); assert.deepEqual(state.inventory, inventory);
    assert.match(glyph(state, 'departure-copy'), /TOVABBMEGYEK/);
    if (selected === 'departure-reserved') assert.match(glyph(state, 'departure-copy'), /ONKENTESSEGET NEM IGAZOLOM/);
    else assert.doesNotMatch(glyph(state, 'departure-copy'), /NEM IGAZOLOM/);
    assert.match(look(state, 'departure-copy').message, /korábbi iratok nem változtak/);
    const recordedReturn = go(reload(state), 'departure-return');
    assert.match(recordedReturn.message, /archívum útja járható/);
    assert.equal(applyCommand(recordedReturn, { verb: 'move', target: { kind: 'exit', id: 'archive:entry' } }).room, 'archive:vestibule');
  }
});

test('registered source legend is spent on the pins in one use and still agrees in prose, art, navigation and reload', () => {
  let state = at(aw('source-room'), [aw('flow-latched')], [aw('source-card')]);
  assert.match(view(state).scene.description, /rögzítőtüske várja a műhely oszlopmintáját/);
  assert.equal((glyph(state, 'card-bed').match(/o/g) ?? []).length, 3);
  state = use(state, 'card-bed', aw('source-card'));
  assert.ok(!state.inventory.includes(aw('source-card')), 'the legend stays on the pins');
  assert.throws(() => use(state, 'card-bed', aw('source-card')), /Érvénytelen művelet/);
  for (let repeat = 0; repeat < 3; repeat++) {
    state = reload(state);
    const rendered = view(state);
    assert.match(rendered.scene.description, /már a forráslap oszlopaihoz igazodnak/);
    assert.doesNotMatch(rendered.scene.description, /várja a műhely oszlopmintáját/);
    assert.match(rendered.scene.description, /ajtaja még zárva/);
    assert.match(glyph(state, 'card-bed'), /: :\s+::\s+_/);
    assert.match(look(state, 'card-bed').message, /SZEMLE, KÖZLÉS és HIÁNY/);
    assert.match(look(state, 'card-bed').message, /lap a tüskéken maradt/);
    assert.ok(!state.inventory.includes(aw('source-card')));
    assert.equal(go(state, 'decision').room, aw('source-room'));
    state = go(go(state, 'source-back'), 'sorting');
  }
  state = solveSources(state);
  const entry = state.book.find(entry => entry.id === aw('sources-separated'))!;
  assert.match(entry.text, /Saját feljegyzést készítettem/);
  assert.doesNotMatch(entry.text, /szerettem volna|végre nem hagyta/);
});

test('hidden objects, recipe ingredients, finished tools and current drawings stay consistent through crafting, return and reload', () => {
  let state = enterWing(); assert.ok(!view(state).environment.some(entity => entity.id === aw('loose-frame')));
  assert.throws(() => take(state, 'loose-frame'), /célpont/);
  state = take(look(state, 'coats'), 'loose-frame'); state = go(state, 'water');
  assert.ok(!JSON.stringify(view(state)).includes('loose-prism')); state = take(solveWater(state), 'loose-prism'); state = go(state, 'water-back');
  state = applyCommand(state, { verb: 'combine', item: aw('prism'), target: { kind: 'item', id: aw('frame') } });
  state = look(reload(state), 'coats'); assert.match(state.message, /kiemelted/); assert.ok(!JSON.stringify(view(state)).includes('loose-frame'));
  assert.throws(() => take(state, 'loose-frame'), /célpont/);
  state = go(state, 'water'); assert.ok(!JSON.stringify(view(state)).includes('loose-prism')); assert.throws(() => take(state, 'loose-prism'), /célpont/);
  assert.ok(state.inventory.includes(aw('viewer')) && state.inventory.includes('bridge'));
  for (const old of ['chamber', aw('bed-rim'), aw('panel-detail')]) {
    const returned = old === 'chamber' ? { ...state, room: old } : { ...state, room: 'chamber', focus: old === aw('bed-rim') ? [aw('bed-detail'), old] : [old] };
    const rendered = view(returned);
    assert.ok(!rendered.environment.some(entity => ['loose-foil', 'loose-wire'].includes(entity.id)), 'old crafted materials never respawn');
  }
});

test('whole first-chapter authored graph has return paths, substantive examinations, local targets and nonoverlapping ASCII hit regions', () => {
  const ids = new Set(Object.keys(awakening.scenes)), edges = new Map<string, Set<string>>();
  for (const [id, scene] of Object.entries(awakening.scenes)) {
    edges.set(id, new Set(scene.rules.flatMap(rule => rule.moveTo || rule.focusTo ? [rule.moveTo ?? rule.focusTo!] : [])));
    if (scene.detailOf) edges.get(id)!.add(scene.detailOf);
    for (const entity of scene.environment ?? []) {
      assert.ok((entity.description?.length ?? 0) > 50 || scene.rules.some(rule => rule.kind === 'look' && rule.interaction?.target?.id === entity.id && rule.message.length > 50), entity.id);
      assert.ok(scene.artSpots!.some(spot => spot.environment === entity.id));
    }
    const spots = scene.artSpots!;
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i], b = spots[j]; assert.ok(a.col + a.width <= b.col || b.col + b.width <= a.col || a.row + a.height <= b.row || b.row + b.height <= a.row, `${id}: ${a.id}/${b.id}`);
    }
    for (const rule of scene.rules) if (rule.interaction?.target?.kind === 'environment') assert.ok(scene.environment!.some(entity => entity.id === rule.interaction!.target!.id));
  }
  for (const id of ids) {
    const seen = new Set<string>(), queue = [id];
    while (queue.length) { const next = queue.shift()!; if (seen.has(next)) continue; seen.add(next); queue.push(...[...edges.get(next) ?? []].filter(edge => ids.has(edge))); }
    assert.ok(seen.has('threshold'), `structural return from ${id}`);
  }
  for (const id of physical) {
    const requirements = awakening.scenes[id].requires!;
    const state = at(id, requirements.flags?.filter(flag => flag !== 'door-open') ?? []);
    const publicView = JSON.stringify(view(state));
    assert.doesNotMatch(publicView, /glyphVariants|messageVariants|withoutFlags|removeFlags|addFlags|combine:viewer|chapter-closed/);
    assert.deepEqual(reload(state).book, state.book);
    if (id === aw('decision-room')) assert.ok(applyAction(state, 'awakening:use:departure-plain:record').flags.includes(aw('chapter-closed')));
    else assert.throws(() => applyAction(state, 'awakening:use:departure-plain:record'), /művelet/);
  }
  assert.ok(!meets(initialState(), CATALOG.scenes[aw('decision-room')].requires));
});
