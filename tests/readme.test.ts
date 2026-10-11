import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {SHOP_IDS,SHOP_NAMES} from '../lib/pokemon/types.ts';
const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
test('README links point to existing repository documents and cover the current registry, versions and notification locations',()=>{
  for(const match of readme.matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(match[1]))assert.ok(existsSync(new URL('../'+match[1].split('#')[0],import.meta.url)),match[1]);
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')),android=readFileSync(new URL('../android/app/build.gradle',import.meta.url),'utf8').match(/versionName '([^']+)'/)![1];
  assert.ok(readme.includes('**Web:** '+pkg.version));assert.ok(readme.includes('**Android:** '+android));
  for(const id of SHOP_IDS)assert.ok(readme.includes(SHOP_NAMES[id]),id);
  assert.ok(readme.includes('/config#notifications'));assert.ok(readme.includes('Pokémon-olvasónak `/notifications`'));
  assert.ok(readme.includes('https://wydrian1.github.io/nas_dashboard/'));assert.ok(readme.includes('3–60 perc'));
});
test('browser release checks copy the build instead of sharing mutable route cache with packaging',()=>{
  const code=readFileSync(new URL('../scripts/Test-Browser.mjs',import.meta.url),'utf8');
  assert.match(code,/cpSync\(join\(root,'\.next-staging'\),join\(fixture,'\.next'\)/);
  assert.doesNotMatch(code,/symlinkSync\(join\(root,'\.next-staging'\)/);
});
