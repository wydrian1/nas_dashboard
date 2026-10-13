// Generic deterministic engine: story, puzzles and milestone prose live in chapters.
import { CATALOG, meets, type AdventureCatalog } from './catalog.ts';
import { INTRO, OPENING_ENTRY } from './chapters/awakening.ts';
import type { GameAction, GameState, StoryEntry } from './types.ts';
export type { GameAction, GameState, StoryEntry } from './types.ts';
export { INTRO } from './chapters/awakening.ts';
export const GAME_VERSION = 1;
export const ITEM_NAMES = CATALOG.items;
export const SCENES = CATALOG.scenes;
export function initialState(): GameState {
  return { version: GAME_VERSION, room: 'chamber', inventory: [], flags: [], journal: ['7314. Kilencedik ébresztés. A saját hangom óvott a nevemtől.'], book: [{ ...OPENING_ENTRY }], message: INTRO, turns: 0 };
}
export function availableActions(state: GameState, catalog: AdventureCatalog = CATALOG): GameAction[] {
  return (catalog.scenes[state.room]?.rules ?? []).filter(rule => meets(state, rule.requires)).map(({ id, label, kind }) => ({ id, label, kind }));
}
export function applyAction(current: GameState, actionId: string, catalog: AdventureCatalog = CATALOG): GameState {
  const rule = catalog.scenes[current.room]?.rules.find(rule => rule.id === actionId && meets(current, rule.requires));
  if (!rule) throw new Error('Ez a művelet most nem érhető el.');
  const state: GameState = { ...current, inventory: [...current.inventory], flags: [...current.flags], journal: [...current.journal], book: [...current.book], turns: current.turns + 1, message: rule.message };
  state.inventory = [...new Set([...state.inventory.filter(item => !(rule.removeItems ?? []).includes(item)), ...rule.addItems ?? []])];
  state.flags = [...new Set([...state.flags, ...rule.addFlags ?? []])];
  state.journal = [...new Set([...state.journal, ...rule.notes ?? []])];
  if (rule.moveTo) {
    if (!meets(state, catalog.scenes[rule.moveTo].requires)) throw new Error('A célhelyszín még nem érhető el.');
    state.room = rule.moveTo;
  }
  if (rule.milestone && !state.book.some(entry => entry.id === rule.milestone!.id)) {
    state.book.push({ ...rule.milestone, chapter: catalog.ruleOwners[`${current.room}:${rule.id}`], turn: state.turns });
  }
  return state;
}
function validEntry(entry: StoryEntry, turns: number) {
  return entry && ['id', 'chapter', 'title', 'text'].every(key => typeof entry[key as keyof StoryEntry] === 'string' && String(entry[key as keyof StoryEntry]).length < 20000) && Number.isSafeInteger(entry.turn) && entry.turn >= 0 && entry.turn <= turns;
}
export function parseState(json: string, catalog: AdventureCatalog = CATALOG): GameState {
  const value = JSON.parse(json) as GameState;
  if (!value || value.version !== GAME_VERSION || typeof value.room !== 'string' || !Object.hasOwn(catalog.scenes, value.room) ||
    !Array.isArray(value.inventory) || !value.inventory.every(item => typeof item === 'string' && Object.hasOwn(catalog.items, item)) || new Set(value.inventory).size !== value.inventory.length ||
    !Array.isArray(value.flags) || !value.flags.every(flag => catalog.flags.has(flag)) || new Set(value.flags).size !== value.flags.length ||
    !Array.isArray(value.journal) || !value.journal.every(note => typeof note === 'string' && note.length < 20000) ||
    typeof value.message !== 'string' || value.message.length > 20000 || !Number.isSafeInteger(value.turns) || value.turns < 0 ||
    !Array.isArray(value.book) || !value.book.every(entry => validEntry(entry, value.turns)) || new Set(value.book.map(entry => entry.id)).size !== value.book.length ||
    !meets(value, catalog.scenes[value.room].requires)) throw new Error('A mentés nem támogatott vagy sérült. Nem írtuk felül.');
  return value;
}
