import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSectionOrder,sectionOrder,moveSection} from '../lib/section-order.ts';
test('browser section preferences reject corrupt payloads, keep stable IDs and append new sections',()=>{
  for(const value of [null,'{bad','{}','"oops"','x'.repeat(10001)])assert.deepEqual(readSectionOrder(value),[]);
  assert.deepEqual(readSectionOrder('["b","b","a",false,"<script>","../secret"]'),['b','a']);
  assert.deepEqual(sectionOrder(['a','b','new'],['removed','b','b','a']),['b','a','new']);
  assert.deepEqual(sectionOrder(['chart','composition','balances'],['movers','balances','composition','chart']),['balances','composition','chart']);
  const order=['a','b','c'];assert.deepEqual(moveSection(order,'b',-1),['b','a','c']);assert.deepEqual(moveSection(order,'b',1),['a','c','b']);assert.deepEqual(order,['a','b','c']);assert.equal(moveSection(order,'a',-1),order);assert.equal(moveSection(order,'c',1),order);assert.equal(moveSection(order,'missing',1),order);
});
test('section controls are local-only, small, labelled and do not submit underlying forms',()=>{
  const code=readFileSync(new URL('../app/local-sections.tsx',import.meta.url),'utf8');assert.match(code,/localStorage\.setItem/);assert.doesNotMatch(code,/fetch\(|document\.cookie|server|\/api\//);assert.equal((code.match(/type="button"/g)||[]).length,3);assert.match(code,/aria-label/);assert.match(code,/key=\{id\}/);
});
test('compact controls occupy a separate right-side rail rather than an absolute row above the content',()=>{
  const code=readFileSync(new URL('../app/local-sections.tsx',import.meta.url),'utf8'),css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.ok(code.indexOf('className="local-section-content"')<code.indexOf('className="section-order-controls"'));
  assert.match(css,/\.local-section\{display:flex;align-items:flex-start;gap:8px;min-width:0\}/);assert.match(css,/\.local-section-content\{flex:1;min-width:0\}/);
  assert.match(css,/\.section-order-controls\{display:flex;flex-direction:column;gap:4px;flex:0 0 24px\}/);assert.match(css,/\.section-order-controls button\{width:24px;height:24px/);
  assert.doesNotMatch(css,/\.local-section\{[^}]*padding-top|\.section-order-controls\{[^}]*position:absolute/);
});
test('wide desktop content stays anchored beside the sidebar without an expanding empty left gutter',()=>{
  const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.match(css,/\.main-content\{margin-left:248px;max-width:1500px;padding:0 52px;width:calc\(100% - 248px\)\}/);
  assert.doesNotMatch(css,/margin-left:calc\(248px\s*\+|100vw\s*-\s*1600px/);
  assert.match(css,/@media\(max-width:720px\)/);assert.match(css,/\.main-content\{margin:0;width:100%;padding:0 20px\}/);
});
