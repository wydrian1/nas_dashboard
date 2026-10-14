import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkStory} from '../apps/nullpont/scripts/Check-Story.mjs';
import {fileURLToPath} from 'node:url';
test('NULLPONT story-review profile and mandatory acceptance workflow are versioned, spoiler-free and gated',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const agent=source('.opencode/agents/nullpont-story-steward.md'),workflow=source('apps/nullpont/AGENTS.md');
  assert.match(agent,/mode: subagent/);assert.match(agent,/missing or unreadable, return BLOCKED/);
  assert.match(agent,/never its contents/);assert.match(workflow,/author may not self-approve/);
  assert.match(workflow,/REJECTED or BLOCKED stops acceptance/);
  assert.equal(checkStory(fileURLToPath(new URL('../apps/nullpont',import.meta.url))).passed,true);
  assert.match(source('.gitignore'),/^\.runtime\/$/m);
});
