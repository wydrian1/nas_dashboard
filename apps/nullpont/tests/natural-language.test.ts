import test from 'node:test';
import assert from 'node:assert/strict';
import { awakening } from '../lib/game/chapters/awakening.ts';
import { archive } from '../lib/game/chapters/archive.ts';
import { relay } from '../lib/game/chapters/relay.ts';
import { applyCommand } from '../lib/game/engine.ts';
import { gameView } from '../lib/game/view.ts';
import { aw, closeAwakening, enterWing, go, look, openOriginal, reload, solveLight, solveSources, solveWater, take, use } from './helpers/awakening-route.ts';
import type { GameState } from '../lib/game/types.ts';

const view = (state: GameState) => gameView({ state, revision: 0, updatedAt: 'now' });

test('eleven other corridor doors support separate inspection, opening attempts and calling without invented occupants or lost access', () => {
  const start = openOriginal();
  let state = look(start, 'hall-doors');
  assert.equal(state.focus?.at(-1), aw('corridor-doors'));
  const doors = view(state).environment;
  assert.equal(doors.length, 11);
  assert.equal(new Set(doors.map(door => door.label)).size, 11);
  for (const door of doors) {
    for (const verb of ['look', 'use', 'talk'] as const) {
      state = applyCommand(reload(state), { verb, target: { kind: 'environment', id: door.id } });
      assert.ok(state.message.length > 60);
      assert.deepEqual(state.inventory, start.inventory);
      assert.deepEqual(state.flags, start.flags);
      assert.deepEqual(state.book, start.book);
      assert.equal(state.room, 'threshold');
      assert.equal(state.focus?.at(-1), aw('corridor-doors'));
    }
  }
  state = applyCommand(reload(state), { verb: 'back' });
  assert.equal(state.focus?.length ?? 0, 0);
  state = applyCommand(state, { verb: 'move', target: { kind: 'exit', id: 'chamber' } });
  assert.equal(state.room, 'chamber');
  assert.ok(state.flags.includes('door-open'));
  assert.equal(awakening.scenes[aw('corridor-doors')].detailOf, 'threshold');
  assert.doesNotMatch(JSON.stringify(awakening.scenes[aw('corridor-doors')]), /klón|felvétel|BELÜL 0[78]/i);
});

test('the machinery explains volume, supply, drain, float rods and an independently held-open steel route', () => {
  let state = go(enterWing(), 'water');
  assert.match(view(state).scene.description, /üveghengerben.*töltőcsap.*lefolyóvályúba.*úszók rúdjai/i);
  assert.match(look(state, 'float-test').message, /bevágás.*retesz/);
  state = solveWater(state);
  assert.match(state.message, /rudak bevágásai.*kar.*acélajtó.*rögzítő/i);
  state = use(use(reload(state), 'empty-large'), 'fill');
  assert.ok(state.flags.includes(aw('flow-latched')));
  assert.match(view(state).scene.description, /külön rögzítő.*nem zárja vissza/);
  assert.equal(go(go(state, 'water-back'), 'sorting').room, aw('source-room'));
});

test('prism and foil reflection have a physical light path and taking the card requires releasing its clip', () => {
  for (const item of [aw('prism'), 'bridge']) {
    let state = go(enterWing(), 'water');
    state = take(solveWater(state), 'loose-prism');
    state = go(go(state, 'water-back'), 'light');
    assert.match(look(state, 'optics-note').message, /hasáb.*fólia.*hurok.*oldalról/);
    assert.ok(!use(state, 'relief', item).flags.includes(aw('relief-read')));
    state = solveLight(state, item);
    assert.match(state.message, /árnyék.*kioldófül/);
    assert.doesNotMatch(state.message, /csipesz felenged/);
    assert.match(look(state, 'loose-source-card').message, /csipesz még fogja/i);
    state = take(state, 'loose-source-card');
    assert.match(state.message, /Megnyomod a kioldófület.*kihúzod/);
    state = reload(go(go(state, 'light-back'), 'light'));
    assert.match(view(state).scene.description, /üres csipesz/);
    assert.ok(!view(state).environment.some(entity => entity.id === aw('loose-source-card')));
  }
});

test('the player records observed wrist scars, alleged consent and missing name without a truth-detecting desk', () => {
  let state = go(enterWing(), 'water');
  state = solveWater(state);
  state = go(go(state, 'water-back'), 'light');
  state = take(solveLight(state, 'bridge'), 'loose-source-card');
  state = go(go(state, 'light-back'), 'sorting');
  assert.match(look(state, 'wrist-source').message, /kilenc apró heg.*hegek meglétét.*nem azt, ki és mikor/);
  assert.match(look(state, 'claim-source').message, /múltbeli beleegyezésre nem emlékszel/);
  assert.match(look(state, 'source-check').message, /lapokat illeszti.*nem tudja eldönteni/);
  state = solveSources(state);
  assert.match(state.message, /papírcsík.*réseken.*Nem a múltat igazoltad/);
  assert.match(state.book.find(entry => entry.id === aw('sources-separated'))!.text, /kilenc heg a csuklómon/);
  assert.doesNotMatch(state.book.find(entry => entry.id === aw('sources-separated'))!.text, /ajtón felirat van/);
  assert.ok(!state.flags.includes(aw('chapter-closed')));
});

test('awakening goals follow the local next step and never leak into later chapters', () => {
  let state = enterWing();
  assert.match(view(state).goal!, /vízkör/);
  state = solveWater(go(state, 'water'));
  assert.match(view(state).goal!, /műhely.*feljegyzés/);
  for (const reserved of [false, true]) {
    const closed = closeAwakening(openOriginal(), { reserved, reloads: true });
    assert.match(view(closed).goal!, /ablak melletti keskeny átjárón/);
    const next = applyCommand(closed, { verb: 'move', target: { kind: 'exit', id: 'archive:entry' } });
    assert.notEqual(view(next).goal, view(closed).goal);
    const later = { ...next, room: 'relay:gallery', flags: [...next.flags, 'relay:destination-known'] };
    assert.match(view(later).goal!, /Fogadóállomás/);
    assert.deepEqual(closed.inventory, next.inventory);
  }
  assert.ok(awakening.goals!.every(goal => goal.rooms?.length));
});

test('plain physical labels replace invented bureaucracy while unexplained evidence inscriptions remain', () => {
  const chapters = JSON.stringify([awakening, archive, relay]);
  assert.doesNotMatch(chapters, /kilépési szemle|puha redőny|lapágy|másolatfogó|tanúlemez/i);
  assert.match(archive.itemDescriptions!['archive:witness'], /TANÚPÉLDÁNY \/ HELYBEN NEM OLVASHATÓ/);
  assert.match(archive.itemDescriptions!['archive:witness'], /rendeltetését nem magyarázza/);
  assert.match(relay.scenes['relay:receiver-room'].environment!.find(entity => entity.id === 'relay:tube-mouth')!.description!, /füstszínű lemez/);
});
