import test from 'node:test';
import assert from 'node:assert/strict';
import { performReviewAction } from '../scripts/nullpont-player-review-action.mjs';
import { writeReviewFile } from '../scripts/nullpont-player-review-io.mjs';
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('a successful review action with a slow render is pending, not failed or clicked twice', async () => {
  let clicks = 0;
  const target = { click: async () => { clicks++; } };
  const page = { locator: () => ({ waitFor: async () => { throw Error('render timeout'); } }) };
  const result = await performReviewAction(page, target, { kind: 'click' }, 1);
  assert.equal(clicks, 1);
  assert.equal(result.pending, true);
  assert.match(result.warning, /observe/);
});

test('review action failures remain errors and successful renders need no warning', async () => {
  const page = { locator: () => ({ waitFor: async () => {} }) };
  await assert.rejects(performReviewAction(page, { click: async () => { throw Error('detached'); } }, { kind: 'click' }), /detached/);
  let value = '';
  assert.deepEqual(await performReviewAction(page, { fill: async (text: string) => { value = text; } }, { kind: 'fill', value: 'visible input' }), {});
  assert.equal(value, 'visible input');
});

test('transient response-file locks retry publication without leaving temporary files', () => {
  const dir=mkdtempSync(join(tmpdir(),'nullpont-review-io-'));
  try {
    let attempts=0;
    const path=join(dir,'response.json');
    writeReviewFile(path,{id:'response'},(from: Parameters<typeof renameSync>[0],to: Parameters<typeof renameSync>[1])=>{
      if(++attempts<3) throw Object.assign(Error('locked'),{code:'EBUSY'});
      renameSync(from,to);
    });
    assert.equal(attempts,3);
    assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),{id:'response'});
    assert.deepEqual(readdirSync(dir),['response.json']);
    assert.throws(()=>writeReviewFile(path,{},()=>{throw Object.assign(Error('denied'),{code:'EINVAL'});}),/denied/);
    assert.deepEqual(readdirSync(dir),['response.json']);
    assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),{id:'response'});
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
