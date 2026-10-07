import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSectionOrder,sectionOrder,moveSection} from '../lib/section-order.ts';
test('browser section preferences reject corrupt payloads, keep stable IDs and append new sections',()=>{
  for(const value of [null,'{bad','{}','"oops"','x'.repeat(10001)])assert.deepEqual(readSectionOrder(value),[]);
  assert.deepEqual(readSectionOrder('["b","b","a",false,"<script>","../secret"]'),['b','a']);
  assert.deepEqual(sectionOrder(['a','b','new'],['removed','b','b','a']),['b','a','new']);
  const order=['a','b','c'];assert.deepEqual(moveSection(order,'b',-1),['b','a','c']);assert.deepEqual(moveSection(order,'b',1),['a','c','b']);assert.deepEqual(order,['a','b','c']);assert.equal(moveSection(order,'a',-1),order);assert.equal(moveSection(order,'c',1),order);assert.equal(moveSection(order,'missing',1),order);
});
test('section controls are local-only, small, labelled and do not submit underlying forms',()=>{
  const code=readFileSync(new URL('../app/local-sections.tsx',import.meta.url),'utf8');assert.match(code,/localStorage\.setItem/);assert.doesNotMatch(code,/fetch\(|document\.cookie|server|\/api\//);assert.equal((code.match(/type="button"/g)||[]).length,2);assert.match(code,/aria-label/);assert.match(code,/key=\{id\}/);
});
