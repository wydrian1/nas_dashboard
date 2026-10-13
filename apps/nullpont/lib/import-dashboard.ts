import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, linkSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { initializeDatabase } from './schema.ts';
import { parseState } from './game/engine.ts';

// Run against a consistent backup only. Never modify/open the dashboard for writes.
export function importDashboard(sourcePath: string, destinationPath: string, ownerEmail?: string) {
  const source = resolve(sourcePath), destination = resolve(destinationPath);
  if (source === destination || existsSync(destination)) throw new Error('A céladatbázisnak újnak kell lennie; meglévő mentést nem írunk felül.');
  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error('Érvénytelen tulajdonosi e-mail.');
  const input = new DatabaseSync(source, { readOnly: true });
  let output: DatabaseSync | undefined;
  try {
    input.exec('PRAGMA busy_timeout=5000; BEGIN');
    if (input.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok' || input.prepare('PRAGMA foreign_key_check').all().length) throw new Error('A forrásmentés ellenőrzése sikertelen.');
    const rows = input.prepare('SELECT owner,state_json,revision,updated_at FROM adventure_saves').all() as { owner: string; state_json: string; revision: number; updated_at: string }[];
    const normalized = new Set<string>();
    const saves = rows.map(row => {
      const email = row.owner.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || normalized.has(email) || !Number.isSafeInteger(row.revision) || row.revision < 0 || typeof row.updated_at !== 'string') throw new Error('Érvénytelen vagy ütköző forrásmentés; import leállítva.');
      normalized.add(email);
      return { ...row, email, state: parseState(row.state_json) };
    });
    const hasUsers = input.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dashboard_users'").get();
    const users = hasUsers ? input.prepare('SELECT email,active AS enabled FROM dashboard_users').all() as { email: string; enabled: number }[] : [];
    mkdirSync(dirname(destination), { recursive: true });
    const temporary = destination + '.import-' + randomUUID();
    output = new DatabaseSync(temporary);
    initializeDatabase(output); output.exec('BEGIN IMMEDIATE');
    const player = output.prepare('INSERT INTO players(email,enabled) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET enabled=excluded.enabled');
    for (const user of users) player.run(user.email.trim().toLowerCase(), user.enabled === 1 ? 1 : 0);
    if (ownerEmail) player.run(ownerEmail.trim().toLowerCase(), 1);
    const insert = output.prepare('INSERT INTO adventure_saves(owner,state_json,revision,updated_at) VALUES(?,?,?,?)');
    for (const save of saves) insert.run(save.email, JSON.stringify(save.state), save.revision, save.updated_at);
    output.exec('COMMIT');
    if (output.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok' || output.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Az import ellenőrzése sikertelen.');
    output.close(); output = undefined;
    // Hard-link publication is exclusive: a concurrently created destination is never replaced.
    const result = { imported: saves.length, sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex') };
    publish(temporary, destination);
    return result;
  } finally { output?.close(); input.close(); }
}

function publish(source: string, destination: string) { linkSync(source, destination); unlinkSync(source); }
