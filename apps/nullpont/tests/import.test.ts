import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { importDashboard } from '../lib/import-dashboard.ts';
import { initializeDatabase } from '../lib/schema.ts';
import { initialState } from '../lib/game/engine.ts';
import { loadGame } from '../lib/game/store.ts';
import { playerAuthorized, verifiedEmail } from '../lib/access.ts';
test('import transfers only saves and membership from a read-only snapshot without overwriting an existing destination', () => {
  const base=resolve('.runtime/tests');mkdirSync(base,{recursive:true});const directory=mkdtempSync(join(base,'import-'));
  try {
    const source=join(directory,'dashboard.sqlite'),destination=join(directory,'nullpont.sqlite');
    const database=new DatabaseSync(source);
    database.exec("CREATE TABLE dashboard_users(email TEXT PRIMARY KEY,active INTEGER); INSERT INTO dashboard_users VALUES('one@example.test',1),('disabled@example.test',0); CREATE TABLE notes(secret TEXT); INSERT INTO notes VALUES('not copied');");
    initializeDatabase(database);
    const { discoveries, ...old } = initialState();
    database.prepare('INSERT INTO adventure_saves VALUES(?,?,?,?)').run('one@example.test',JSON.stringify({...old,version:1}),7,'2026-10-13T00:00:00Z');
    database.close();const bytes=readFileSync(source);
    assert.equal(importDashboard(source,destination).imported,1);
    assert.deepEqual(readFileSync(source),bytes);
    const result=new DatabaseSync(destination,{readOnly:true});
    try{const game=loadGameReadOnly(result);assert.equal(game.revision,7);assert.equal(game.state.version,2);assert.deepEqual(game.state.book,old.book);assert.equal(result.prepare("SELECT 1 FROM sqlite_master WHERE name='notes'").get(),undefined);assert.equal(playerAuthorized(result,'one@example.test',''),true);assert.equal(playerAuthorized(result,'disabled@example.test','disabled@example.test'),false);}finally{result.close();}
    assert.throws(()=>importDashboard(source,destination));
    const broken=new DatabaseSync(source);broken.prepare('UPDATE adventure_saves SET state_json=?').run('{"version":99}');broken.close();
    const other=join(directory,'other.sqlite');assert.throws(()=>importDashboard(source,other));assert.equal(existsSync(other),false);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
function loadGameReadOnly(database:DatabaseSync){const row=database.prepare('SELECT state_json,revision FROM adventure_saves').get()!;return {revision:row.revision,state:JSON.parse(String(row.state_json))};}
test('independent authorization fails closed, normalizes email and respects disabling an existing JWT owner', () => {
  const database=new DatabaseSync(':memory:');try{initializeDatabase(database);assert.equal(playerAuthorized(database,'owner@example.test','owner@example.test'),true);assert.equal(playerAuthorized(database,'other@example.test','owner@example.test'),false);database.prepare('INSERT INTO players VALUES(?,0)').run('owner@example.test');assert.equal(playerAuthorized(database,'OWNER@example.test','owner@example.test'),false);assert.equal(verifiedEmail({email:'One@Example.test',email_verified:true}),'one@example.test');assert.equal(verifiedEmail({email:'one@example.test',email_verified:false}),null);}finally{database.close();}
});
