import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkStory} from '../apps/nullpont/scripts/Check-Story.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
test('NULLPONT story-review profile and mandatory acceptance workflow are versioned, spoiler-free and gated',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const agent=source('.opencode/agents/nullpont-story-steward.md'),workflow=source('apps/nullpont/AGENTS.md');
  assert.match(agent,/mode: subagent/);assert.match(agent,/missing or unreadable, return BLOCKED/);
  assert.match(agent,/never its contents/);assert.match(workflow,/author may not self-approve/);
  assert.match(workflow,/REJECTED or BLOCKED stops acceptance/);
  assert.equal(checkStory(fileURLToPath(new URL('../apps/nullpont',import.meta.url))).passed,true);
  assert.match(source('.gitignore'),/^\.runtime\/$/m);
});
test('steward shell operations use one bounded runner without recurring approval or arbitrary commands',()=>{
  const profile=readFileSync(new URL('../.opencode/agents/nullpont-story-steward.md',import.meta.url),'utf8');
  assert.match(profile,/action: shell\s+resource: "\*"\s+effect: deny/);
  assert.doesNotMatch(profile,/action: shell\s+resource: "\*"\s+effect: (allow|ask)/);
  const resources=[...profile.matchAll(/action: shell\s+resource: "([^"]+)"\s+effect: allow/g)].map(match=>match[1]);
  const prefix='D:/!nas/.runtime/node-v24.21.0-win-x64/node.exe .opencode/scripts/story-steward.mjs ';
  const operations=['inputs','check','test','timestamp','storyboard-hash','diff','status'];
  assert.deepEqual(resources,operations.map(operation=>prefix+operation));
  assert.ok(resources.every(resource=>!/[*?]/.test(resource)),'shell grants are exact commands, not argument-prefix wildcards');
  // Exact whole-command grants also fail closed if a shell scanner ever presents
  // an unsplit compound string; split additional commands hit the broad deny.
  for(const command of [prefix+'inputs; '+prefix+'timestamp',prefix+'inputs && '+prefix+'timestamp',prefix+'inputs extra','node -e "1"',prefix+'storyboard-hash other-file','$env:PATH="other"; '+prefix+'inputs'])assert.ok(!resources.includes(command));
  const runner=fileURLToPath(new URL('../.opencode/scripts/story-steward.mjs',import.meta.url));
  const run=(...args:string[])=>spawnSync(process.execPath,[runner,...args],{encoding:'utf8',timeout:10000});
  const inputs=run('inputs');assert.equal(inputs.status,0);assert.ok(JSON.parse(inputs.stdout).chapters.length>=1);
  const checked=run('check');assert.equal(checked.status,0);assert.equal(JSON.parse(checked.stdout).passed,true);
  const timestamp=run('timestamp');assert.equal(timestamp.status,0);assert.ok(Number.isFinite(Date.parse(timestamp.stdout.trim())));
  for(const args of [[],['execute'],['inputs','--destination','private'],['storyboard-hash','some-other-file'],['test','--eval','throw 1']])assert.notEqual(run(...args).status,0);
  const packageSource=readFileSync(new URL('../apps/nullpont/scripts/Package-Release.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(packageSource,/const sources=.*\.opencode/);
});
