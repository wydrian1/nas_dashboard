import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { initializeDatabase } from './schema';
let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  const configured = process.env.NULLPONT_DATA_DIR?.trim();
  if (configured && !isAbsolute(configured)) throw new Error('NULLPONT_DATA_DIR must be absolute');
  const directory = configured || resolve('data');
  mkdirSync(directory, { recursive: true });
  const opened = new DatabaseSync(join(directory, 'nullpont.sqlite'));
  try { initializeDatabase(opened); opened.exec('PRAGMA journal_mode=WAL'); database = opened; }
  catch (error) { opened.close(); throw error; }
  return database;
}
