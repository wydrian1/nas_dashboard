// Developer-side fixtures; never imported by the player application.
import { applyAction, applyCommand, initialState, parseState } from '../../lib/game/engine.ts';
import type { GameState, PlayerCommand } from '../../lib/game/types.ts';
export const aw = (name: string) => `awakening:${name}`;
export const command = (state: GameState, verb: PlayerCommand['verb'], name: string, item?: string) => applyCommand(state, { verb, target: { kind: verb === 'move' ? 'exit' : 'environment', id: aw(name) }, ...(item ? { item } : {}) });
export const go = (state: GameState, name: string) => command(state, 'move', name);
export const use = (state: GameState, name: string, item?: string) => command(state, 'use', name, item);
export const look = (state: GameState, name: string) => command(state, 'look', name);
export const take = (state: GameState, name: string) => command(state, 'take', name);
export const reload = (state: GameState) => parseState(JSON.stringify(state));
export function openOriginal(options: { wireFirst?: boolean; reverseCraft?: boolean; closeup?: boolean; dialogue?: number } = {}) {
  let state = initialState();
  if (options.dialogue) state = applyAction(state, 'talk:voice');
  if (options.dialogue === 2) state = applyAction(state, 'talk:identity');
  if (options.dialogue === 3) { state = applyAction(state, 'attack:voice'); state = applyAction(state, 'talk:help'); }
  for (const item of options.wireFirst ? ['wire', 'foil'] : ['foil', 'wire']) {
    state = applyAction(state, item === 'wire' ? 'look:panel' : 'look:bed');
    if (item === 'foil') state = applyAction(state, 'look:rim');
    state = applyAction(state, `take:${item}`);
    state = applyCommand(state, { verb: 'back', levels: state.focus!.length });
  }
  state = applyCommand(state, { verb: 'combine', item: options.reverseCraft ? 'wire' : 'foil', target: { kind: 'item', id: options.reverseCraft ? 'foil' : 'wire' } });
  if (options.closeup) state = applyAction(state, 'look:panel');
  state = applyCommand(state, { verb: 'use', item: 'bridge', target: { kind: 'environment', id: options.closeup ? aw('panel-contacts') : 'panel' } });
  if (state.focus?.length) state = applyCommand(state, { verb: 'back' });
  return applyAction(state, 'move:threshold');
}
export function enterWing(state = openOriginal()) {
  state = applyCommand(state, { verb: 'look', target: { kind: 'environment', id: 'hall-window' } });
  return go(state, 'wing-entry');
}
export function solveWater(state: GameState) {
  // Recovery works from every finite starting volume, without a reset/save edit.
  for (const name of ['empty-large', 'empty-small', 'fill', 'pour-small', 'empty-small', 'pour-small', 'fill', 'pour-small', 'empty-small', 'float-test']) state = use(state, name);
  return state;
}
export function solveLight(state: GameState, item: string) {
  for (let attempt = 0; attempt < 3 && !state.flags.includes(aw('angle-2')); attempt++) state = use(state, 'lamp');
  if (!state.flags.includes(aw('shutter-open'))) state = use(state, 'shutter');
  return use(state, 'relief', item);
}
export function solveSources(state: GameState) {
  if (state.inventory.includes(aw('source-card'))) state = use(state, 'card-bed', aw('source-card'));
  for (const [name, desired] of [['wrist-source', 1], ['claim-source', 2], ['name-source', 0]] as const) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const position = state.flags.includes(aw(`${name}-1`)) ? 1 : state.flags.includes(aw(`${name}-2`)) ? 2 : 0;
      if (position === desired) break;
      state = use(state, name);
    }
  }
  return use(state, 'source-check');
}
export function closeAwakening(state = openOriginal(), options: { lightFirst?: boolean; craft?: boolean; reserved?: boolean; reverseCraft?: boolean; reloads?: boolean } = {}) {
  const persist = (state: GameState) => options.reloads ? reload(state) : state;
  state = enterWing(state);
  if (options.lightFirst) { state = go(state, 'light'); state = look(state, 'optics-note'); state = look(state, 'relief'); state = go(state, 'light-back'); }
  if (options.craft) { state = look(state, 'coats'); state = take(state, 'loose-frame'); }
  state = go(state, 'water'); state = solveWater(state); state = take(state, 'loose-prism'); state = persist(state); state = go(state, 'water-back');
  if (options.craft) state = applyCommand(state, { verb: 'combine', item: aw(options.reverseCraft ? 'prism' : 'frame'), target: { kind: 'item', id: aw(options.reverseCraft ? 'frame' : 'prism') } });
  state = go(state, 'light'); state = solveLight(state, aw(options.craft ? 'viewer' : 'prism')); state = persist(state); state = take(state, 'loose-source-card'); state = go(state, 'light-back');
  state = go(state, 'sorting'); state = solveSources(state); state = persist(state); state = go(state, 'decision');
  state = use(state, options.reserved ? 'departure-reserved' : 'departure-plain');
  return go(persist(state), 'departure-return');
}
