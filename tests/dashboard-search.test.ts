import test from 'node:test';
import assert from 'node:assert/strict';
import {searchQuery} from '../lib/global-search.ts';
test('dashboard query parsing rejects arrays, oversized input and controls without altering literal search terms',()=>{
  for(const input of [undefined,null,['one','two'],'a'.repeat(81),'abc\n','abc\x00'])assert.equal(searchQuery(input),'');
  for(const input of ['','a','árvíz %_','<script>literal</script>','a'.repeat(80)])assert.equal(searchQuery(input),input);
});
