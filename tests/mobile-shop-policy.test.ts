import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileShopPolicy} from '../lib/mobile/shop-policy.ts';
import {SHOP_IDS,SHOP_URLS} from '../lib/pokemon/types.ts';
test('mobile shop grants come only from reviewed registry, including exact Alza mobile host and Bloomrift pair',()=>{
  const policy=mobileShopPolicy();assert.equal(policy.version,1);assert.deepEqual(policy.shops.map(shop=>shop.id),SHOP_IDS);
  for(const {id,hosts}of policy.shops){const url=new URL(SHOP_URLS[id]);assert.equal(url.protocol,'https:');const host=url.hostname.replace(/^www\./,'');assert.deepEqual(hosts,id==='alza'?['m.alza.hu']:[host,'www.'+host]);assert.ok(hosts.every(host=>/^[a-z0-9.-]+$/.test(host)));}
  assert.deepEqual(policy.shops.find(shop=>shop.id==='bloomrift')?.hosts,['bloomrift.eu','www.bloomrift.eu']);
  assert.deepEqual(policy.shops.find(shop=>shop.id==='alza')?.hosts,['m.alza.hu']);
  policy.shops[0].hosts[0]='evil.example';assert.notEqual(mobileShopPolicy().shops[0].hosts[0],'evil.example');
});
test('shop policy endpoint requires native bearer authorization and origin guard; cookies never grant a policy',()=>{
  const source=readFileSync(new URL('../app/api/mobile/shops/route.ts',import.meta.url),'utf8');assert.match(source,/deviceBySecret\(db\(\),bearer\(request\)\)/);assert.match(source,/origin&&origin!=='https:\/\/nas.wydrian.hu'/);assert.match(source,/headers:mobileHeaders/);assert.doesNotMatch(source,/requireUser|request\.json|searchParams/);
});
