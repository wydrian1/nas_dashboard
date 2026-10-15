// Generic deterministic engine: story, puzzles and milestone prose live in chapters.
import { CATALOG, meets, type AdventureCatalog } from './catalog.ts';
import { INTRO, OPENING_ENTRY } from './chapters/awakening.ts';
import type { GameAction, GameState, StoryEntry, PlayerCommand } from './types.ts';
export type { GameAction, GameState, StoryEntry } from './types.ts';
export { INTRO } from './chapters/awakening.ts';
export const GAME_VERSION = 2;
export const ITEM_NAMES = CATALOG.items;
export const SCENES = CATALOG.scenes;
function contextRules(state: GameState, catalog: AdventureCatalog) {
  const local = catalog.scenes[activeSceneId(state)]?.rules ?? [];
  return [...local, ...catalog.portableRules.map(entry => entry.rule).filter(rule => !local.includes(rule))];
}
export function activeSceneId(state: GameState): string { return state.focus?.at(-1) ?? state.room; }
function validFocus(state: GameState, catalog: AdventureCatalog): boolean {
  if (catalog.scenes[state.room]?.detailOf) return false;
  if (state.focus === undefined) return true;
  if (!Array.isArray(state.focus) || state.focus.length > 32 || new Set(state.focus).size !== state.focus.length) return false;
  let parent = state.room;
  for (const id of state.focus) {
    if (typeof id !== 'string' || !Object.hasOwn(catalog.scenes, id) || catalog.scenes[id].detailOf !== parent || !meets(state, catalog.scenes[id].requires)) return false;
    parent = id;
  }
  return true;
}
// Arrival reveals only authored baseline objects, never inspection effects,
// journal notes, milestones or an extra turn. Legacy modules can reuse their
// untargeted exploration rule's discovery list without executing that rule.
export function observeRoom(state: GameState, catalog: AdventureCatalog = CATALOG): GameState {
  const scene = catalog.scenes[activeSceneId(state)];
  const baseline = scene.arrivalDiscoveries ?? scene.rules.filter(rule => rule.interaction?.verb === 'look' && !rule.interaction.target && !rule.interaction.item && !rule.interaction.topic && meets(state, rule.requires)).flatMap(rule => rule.discover ?? []);
  const visible = baseline.filter(id => (scene.environment ?? []).some(entity => entity.id === id && meets(state, entity.requires)));
  const discoveries = [...new Set([...state.discoveries, ...visible])];
  return discoveries.length === state.discoveries.length ? state : { ...state, discoveries };
}
export function initialState(): GameState {
  return observeRoom({ version: GAME_VERSION, room: 'chamber', inventory: [], flags: [], discoveries: [], journal: ['7314. Kilencedik ébresztés. A saját hangom óvott a nevemtől.'], book: [{ ...OPENING_ENTRY }], message: INTRO, turns: 0 });
}
export function availableActions(state: GameState, catalog: AdventureCatalog = CATALOG): GameAction[] {
  return contextRules(state, catalog).filter(rule => meets(state, rule.requires)).map(({ id, label, kind }) => ({ id, label, kind }));
}
export function applyAction(current: GameState, actionId: string, catalog: AdventureCatalog = CATALOG, submittedInput?: string): GameState {
  const rule = contextRules(current, catalog).find(rule => rule.id === actionId && meets(current, rule.requires));
  if (!rule) throw new Error('Ez a művelet most nem érhető el.');
  if (rule.kind === 'submit' && (submittedInput === undefined || submittedInput !== rule.interaction?.input)) throw new Error('A művelethez pontos bevitel szükséges.');
  const state: GameState = { ...current, inventory: [...current.inventory], flags: [...current.flags], discoveries: [...current.discoveries], journal: [...current.journal], book: [...current.book], turns: current.turns + 1, message: rule.message };
  state.inventory = [...new Set([...state.inventory.filter(item => !(rule.removeItems ?? []).includes(item)), ...rule.addItems ?? []])];
  state.flags = [...new Set([...state.flags.filter(flag => !(rule.removeFlags ?? []).includes(flag)), ...rule.addFlags ?? []])];
  state.discoveries = [...new Set([...state.discoveries, ...rule.discover ?? []])];
  state.journal = [...new Set([...state.journal, ...rule.notes ?? []])];
  if (rule.moveTo) {
    if (!meets(state, catalog.scenes[rule.moveTo].requires)) throw new Error('A célhelyszín még nem érhető el.');
    state.room = rule.moveTo;
    delete state.focus;
  }
  if (rule.focusTo) {
    if (!meets(state, catalog.scenes[rule.focusTo].requires)) throw new Error('A részlet még nem érhető el.');
    state.focus = [...current.focus ?? [], rule.focusTo];
  }
  if (rule.milestone && !state.book.some(entry => entry.id === rule.milestone!.id)) {
    state.book.push({ ...rule.milestone, chapter: catalog.ruleOwners[`${activeSceneId(current)}:${rule.id}`] ?? catalog.portableRules.find(entry => entry.rule === rule)!.owner, turn: state.turns });
  }
  return observeRoom(state, catalog);
}
function validEntry(entry: StoryEntry, turns: number) {
  return entry && ['id', 'chapter', 'title', 'text'].every(key => typeof entry[key as keyof StoryEntry] === 'string' && String(entry[key as keyof StoryEntry]).length < 20000) && Number.isSafeInteger(entry.turn) && entry.turn >= 0 && entry.turn <= turns;
}
export function parseState(json: string, catalog: AdventureCatalog = CATALOG): GameState {
  const value = JSON.parse(json) as GameState;
  if (value && (value.version as number) === 1 && Array.isArray(value.flags) && Array.isArray(value.inventory)) {
    value.version = GAME_VERSION;
    value.discoveries = value.turns > 0 ? ['bed', 'panel', 'door', 'speaker'] : [];
    if (value.flags.includes('bed-seen')) value.discoveries.push('loose-foil');
    if (value.flags.includes('panel-seen')) value.discoveries.push('loose-wire');
    if (value.room === 'threshold') value.discoveries.push('hall-window');
  }
  if (!value || value.version !== GAME_VERSION || typeof value.room !== 'string' || !Object.hasOwn(catalog.scenes, value.room) ||
    !Array.isArray(value.inventory) || !value.inventory.every(item => typeof item === 'string' && Object.hasOwn(catalog.items, item)) || new Set(value.inventory).size !== value.inventory.length ||
    !Array.isArray(value.flags) || !value.flags.every(flag => catalog.flags.has(flag)) || new Set(value.flags).size !== value.flags.length ||
    !Array.isArray(value.discoveries) || !value.discoveries.every(id => catalog.discoveries.has(id)) || new Set(value.discoveries).size !== value.discoveries.length ||
    !Array.isArray(value.journal) || !value.journal.every(note => typeof note === 'string' && note.length < 20000) ||
    typeof value.message !== 'string' || value.message.length > 20000 || !Number.isSafeInteger(value.turns) || value.turns < 0 ||
    !Array.isArray(value.book) || !value.book.every(entry => validEntry(entry, value.turns)) || new Set(value.book.map(entry => entry.id)).size !== value.book.length ||
    !meets(value, catalog.scenes[value.room].requires) || !validFocus(value, catalog)) throw new Error('A mentés nem támogatott vagy sérült. Nem írtuk felül.');
  return observeRoom(value, catalog);
}

export function applyCommand(state: GameState, command: PlayerCommand, catalog: AdventureCatalog = CATALOG): GameState {
  state = observeRoom(state, catalog);
  if (!command || !['look', 'take', 'use', 'combine', 'talk', 'attack', 'move', 'back', 'submit'].includes(command.verb) ||
    Object.keys(command).some(key => !['verb', 'item', 'target', 'topic', 'input', 'levels'].includes(key)) ||
    (command.input !== undefined && (command.verb !== 'submit' || typeof command.input !== 'string' || command.input.length > 256)) ||
    (command.levels !== undefined && (command.verb !== 'back' || !Number.isSafeInteger(command.levels) || command.levels < 1 || command.levels > 32)) ||
    (command.item !== undefined && (typeof command.item !== 'string' || !state.inventory.includes(command.item))) ||
    (command.topic !== undefined && (typeof command.topic !== 'string' || command.topic.length > 80))) throw new Error('Érvénytelen művelet.');
  if (command.verb === 'back') {
    if (command.target || command.item || command.topic || command.input !== undefined || !state.focus?.length || (command.levels ?? 1) > state.focus.length) throw new Error('Innen nem lehet hátrébb lépni.');
    const next = { ...state, focus: state.focus.slice(0, -(command.levels ?? 1)), turns: state.turns + 1 };
    if (!next.focus.length) delete (next as GameState).focus;
    next.message = catalog.scenes[activeSceneId(next)].description;
    return observeRoom(next, catalog);
  }
  const scene = catalog.scenes[activeSceneId(state)];
  if (command.target !== undefined) {
    const target = command.target;
    if (!target || typeof target.id !== 'string' || Object.keys(target).some(key => !['kind', 'id'].includes(key))) throw new Error('Érvénytelen célpont.');
    const visible = target.kind === 'item' ? state.inventory.includes(target.id) : target.kind === 'environment' ?
      (scene.environment ?? []).some(entity => entity.id === target.id && state.discoveries.includes(entity.id) && meets(state, entity.requires)) : target.kind === 'exit' ?
      (scene.exits ?? []).some(exit => exit.id === target.id && meets(state, exit.requires)) : false;
    if (!visible) throw new Error('Ez a célpont még nem érhető el.');
  }
  if (command.verb === 'submit') {
    const input = scene.inputs?.find(entry => entry.id === command.target?.id && meets(state, entry.requires));
    if (command.target?.kind !== 'environment' || !input || command.item || command.topic || typeof command.input !== 'string') throw new Error('Érvénytelen bevitel.');
    const text = command.input.trim();
    if (!text || text.length > (input.maxLength ?? 80) || /[\x00-\x1f\x7f]/.test(text) || (input.format === 'digits' && !/^\d+$/.test(text))) return { ...state, message: 'Ellenőrizd a bevitel formátumát.' };
    command = { ...command, input: text };
  }
  const candidates = contextRules(state, catalog).filter(rule => meets(state, rule.requires) && rule.interaction);
  const matches = (pattern: PlayerCommand) => pattern.verb === command.verb && pattern.item === command.item && pattern.topic === command.topic && pattern.input === command.input && pattern.target?.kind === command.target?.kind && pattern.target?.id === command.target?.id;
  const rule = candidates.find(rule => matches(rule.interaction!)) ?? (command.verb === 'combine' && command.target?.kind === 'item' ? candidates.find(rule => {
    const pattern = rule.interaction!;
    return pattern.verb === 'combine' && pattern.target?.kind === 'item' && pattern.item === command.target!.id && pattern.target.id === command.item;
  }) : undefined);
  if (rule) return applyAction(state, rule.id, catalog, command.input);
  if (command.verb === 'submit') return { ...state, message: 'A bevitel nem nyitja meg.' };
  if (command.verb === 'look' && command.target?.kind === 'environment' && !command.item && !command.topic) {
    const entity = scene.environment!.find(entry => entry.id === command.target!.id)!;
    return { ...state, turns: state.turns + 1, message: entity.description || `${entity.label}. ${scene.description}` };
  }
  if (command.verb === 'look' && command.target?.kind === 'item' && !command.item && !command.topic) return { ...state, turns: state.turns + 1, message: catalog.itemDescriptions[command.target.id] || `${catalog.items[command.target.id]}. Közelebbről is szemügyre veszed; egyelőre nem találsz rajta új részletet.` };
  if (command.verb === 'look' && !command.target && !command.item && !command.topic) return { ...state, turns: state.turns + 1, message: scene.description };
  return { ...state, turns: state.turns + 1, message: 'Nem történik változás.' };
}
