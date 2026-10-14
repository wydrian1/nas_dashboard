import type { DatabaseSync } from 'node:sqlite';
import { applyCommand, initialState, parseState, type GameState } from './engine.ts';
import type { PlayerCommand } from './types.ts';

export type SavedGame = { state: GameState; revision: number; updatedAt: string };
function ownerKey(email: string) {
  const key = email.trim().toLowerCase();
  if (!key || key.length > 320) throw new Error('Érvénytelen felhasználó.');
  return key;
}
export function loadGame(database: DatabaseSync, email: string): SavedGame {
  const owner = ownerKey(email);
  database.prepare('INSERT OR IGNORE INTO adventure_saves(owner,state_json,revision,updated_at) VALUES(?,?,0,?)').run(owner, JSON.stringify(initialState()), new Date().toISOString());
  const row = database.prepare('SELECT state_json,revision,updated_at FROM adventure_saves WHERE owner=?').get(owner) as { state_json: string; revision: number; updated_at: string };
  return { state: parseState(row.state_json), revision: row.revision, updatedAt: row.updated_at };
}
export function advanceGame(database: DatabaseSync, email: string, revision: number, command: PlayerCommand): { game: SavedGame; conflict: boolean } {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Érvénytelen művelet.');
  const current = loadGame(database, email);
  if (current.revision !== revision) return { game: current, conflict: true };
  const state = applyCommand(current.state, command);
  const updatedAt = new Date().toISOString();
  const result = database.prepare('UPDATE adventure_saves SET state_json=?,revision=revision+1,updated_at=? WHERE owner=? AND revision=?').run(JSON.stringify(state), updatedAt, ownerKey(email), revision);
  if (result.changes !== 1) return { game: loadGame(database, email), conflict: true };
  return { game: { state, revision: revision + 1, updatedAt }, conflict: false };
}
export function resetGame(database: DatabaseSync, email: string, revision: number): { game: SavedGame; conflict: boolean } {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Érvénytelen újrakezdési kérés.');
  const current = loadGame(database, email);
  if (current.revision !== revision) return { game: current, conflict: true };
  const state = initialState(), updatedAt = new Date().toISOString();
  const result = database.prepare('UPDATE adventure_saves SET state_json=?,revision=revision+1,updated_at=? WHERE owner=? AND revision=?').run(JSON.stringify(state),updatedAt,ownerKey(email),revision);
  if (result.changes !== 1) return { game: loadGame(database,email), conflict: true };
  return { game: {state,revision:revision+1,updatedAt}, conflict:false };
}
