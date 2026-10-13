import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionToken, sessionEmail } from '../lib/session.ts';
test('independent game session cannot be forged, reused with another secret or used after expiration',()=>{
  const secret='a'.repeat(43),now=Date.now(),token=sessionToken('one@example.test',secret,now);
  assert.equal(sessionEmail(token,secret,now),'one@example.test');
  assert.equal(sessionEmail(token,'b'.repeat(43),now),null);
  assert.equal(sessionEmail(token+'.extra',secret,now),null);
  assert.equal(sessionEmail(token,secret,now+12*60*60*1000),null);
  assert.equal(sessionEmail(token,'short',now),null);
  assert.throws(()=>sessionToken('one@example.test','short'));
});
