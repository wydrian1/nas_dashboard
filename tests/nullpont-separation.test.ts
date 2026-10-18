import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { nullpontUrl } from '../lib/nullpont-link.ts';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase } from '../lib/db-schema.ts';
test('dashboard link is external and validated; legacy bookmarks redirect without loading game data', () => {
  assert.equal(nullpontUrl('https://game.example.test/'),'https://game.example.test/');
  assert.equal(nullpontUrl('https://wydrian.hu/nullpont'),'https://wydrian.hu/nullpont');
  for (const value of ['', 'javascript:alert(1)', 'http://game.example.test', 'https://nas.wydrian.hu/adventure', 'https://wydrian.hu/adventure', 'https://user:password@game.example.test', 'https://game.example.test/?token=private']) assert.equal(nullpontUrl(value),null);
  const page=readFileSync(new URL('../app/adventure/page.tsx',import.meta.url),'utf8');
  assert.match(page,/redirect\(destination\)/);assert.doesNotMatch(page,/loadGame|advanceGame|lib\/game/);
  assert.equal(existsSync(new URL('../lib/adventure/engine.ts',import.meta.url)),false);
  // The game is its own repository (wydrian1/nullpont): no game source, release
  // tooling or story gate is kept here, only the link and the login handoff.
  for (const moved of ['../apps/nullpont/package.json','../scripts/Nullpont-Player-Review.mjs','../lib/nullpont-player-review.ts','../scripts/Check-Story.mjs','../story/reviews.json']) assert.equal(existsSync(new URL(moved,import.meta.url)),false);
  const database=new DatabaseSync(':memory:');try{database.exec("CREATE TABLE adventure_saves(owner TEXT PRIMARY KEY,state_json TEXT); INSERT INTO adventure_saves VALUES('one@example.test','legacy');");initializeDatabase(database);assert.equal(database.prepare('SELECT state_json FROM adventure_saves').get()!.state_json,'legacy');}finally{database.close();}
});
