import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,cpSync,copyFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
function releaseFixture(){
  const temporary=join(root,'.runtime','research');mkdirSync(temporary,{recursive:true});
  const release=mkdtempSync(join(temporary,'pokemon-worker-release-test-'));
  mkdirSync(join(release,'lib'));mkdirSync(join(release,'scripts'));
  const installer=readFileSync(join(root,'scripts/Install-Pokemon-Worker.ps1'),'utf8');
  for(const [,folder] of installer.matchAll(/Copy-Item -Recurse -LiteralPath 'lib\\([a-z-]+)' -Destination/g))cpSync(join(root,'lib',folder),join(release,'lib',folder),{recursive:true});
  const list=installer.match(/foreach \(\$file in @\(([^)]+)\)\)/)?.[1];assert.ok(list,'installer standalone module list');
  for(const [,file] of list.matchAll(/'([a-z-]+\.ts)'/g))copyFileSync(join(root,'lib',file),join(release,'lib',file));
  copyFileSync(join(root,'scripts/Pokemon-Worker.ts'),join(release,'scripts/Pokemon-Worker.ts'));
  return release;
}
function loadRelease(release:string){
  const worker=join(release,'scripts/Pokemon-Worker.ts'),source=readFileSync(worker,'utf8');
  // Load every runtime import from the real worker without running its persistent
  // scan/push loop. Exercise schema initialization only against in-memory SQLite.
  const modules=[...source.matchAll(/^import (?!type\b).* from ["']([^"']+)["'];/gm)].map(([,specifier])=>specifier.startsWith('.')?pathToFileURL(join(dirname(worker),specifier)).href:specifier);
  const schema=pathToFileURL(join(release,'lib/db-schema.ts')).href;
  return spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`for(const url of ${JSON.stringify(modules)})await import(url);const {DatabaseSync}=await import('node:sqlite');const {initializeDatabase}=await import(${JSON.stringify(schema)});const db=new DatabaseSync(':memory:');try{initializeDatabase(db);if(db.prepare('SELECT COUNT(*) n FROM pokemon_shops').get().n!==13)throw new Error('Missing shop');if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Invalid schema');if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='opencode_access_families'").get())throw new Error('Missing OpenCode schema');}finally{db.close();}`],{cwd:release,encoding:'utf8',timeout:30_000,env:{...process.env,NODE_ENV:'test'}});
}
test('immutable worker installer includes every runtime dependency and initializes current schema in isolation',()=>{
  const release=releaseFixture();try{const result=loadRelease(release);assert.equal(result.status,0,result.stderr);assert.equal(result.error,undefined);}finally{rmSync(release,{recursive:true,force:true});}
});
test('isolated worker release smoke test rejects the missing OpenCode schema dependency before deployment',()=>{
  const release=releaseFixture();try{rmSync(join(release,'lib/opencode-schema.ts'));const result=loadRelease(release);assert.notEqual(result.status,0);assert.match(result.stderr,/ERR_MODULE_NOT_FOUND/);assert.match(result.stderr,/opencode-schema\.ts/);}finally{rmSync(release,{recursive:true,force:true});}
});
