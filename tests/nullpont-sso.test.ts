import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { issueNullpontCode, redeemNullpontCode, ssoHash, bridgeSecretMatches } from '../lib/nullpont-sso.ts';
test('NULLPONT handoff codes are opaque, PKCE-bound, one use and expire after one minute', () => {
  const db=new DatabaseSync(':memory:');try{
    const verifier=randomBytes(32).toString('base64url'),now=Date.now();
    const code=issueNullpontCode(db,'One@Example.test',ssoHash(verifier),now);
    assert.equal(db.prepare('SELECT code_hash FROM nullpont_login_codes').get()!.code_hash,ssoHash(code));
    assert.equal(redeemNullpontCode(db,code,'b'.repeat(43),now),null);
    assert.equal(redeemNullpontCode(db,code,verifier,now),'one@example.test');
    assert.equal(redeemNullpontCode(db,code,verifier,now),null);
    const expired=issueNullpontCode(db,'one@example.test',ssoHash(verifier),now);
    assert.equal(redeemNullpontCode(db,expired,verifier,now+60000),null);
    assert.throws(()=>issueNullpontCode(db,'one@example.test','invalid'));
    assert.equal(redeemNullpontCode(db,{},verifier),null);
  }finally{db.close();}
});
test('dedicated bridge authentication rejects missing, short, wrong and dashboard secrets', () => {
  const secret=randomBytes(32).toString('base64url');
  assert.equal(bridgeSecretMatches('Bearer '+secret,secret),true);
  for(const header of [null,'Bearer short','Bearer '+randomBytes(32).toString('base64url')])assert.equal(bridgeSecretMatches(header,secret),false);
  assert.equal(bridgeSecretMatches('Bearer short','short'),false);
});
