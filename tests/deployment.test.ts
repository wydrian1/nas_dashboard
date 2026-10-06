import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {deploymentSignature,deploymentResult,deploymentPath} from '../lib/deployment/protocol.ts';
const key=Buffer.alloc(32).toString('base64'),id='a'.repeat(32),hash='b'.repeat(64);
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('deployment signatures bind id, timestamp and manifest; signed result tampering is rejected',()=>{
  assert.equal(deploymentSignature(id,'1791000000000',hash,key),'9efa7cd7962549d5830a9bb3df995c15a42446f0c24f9b1208f3d063b88f6d27');
  for(const values of [[id,'1791000000001',hash],['c'.repeat(32),'1791000000000',hash],[id,'1791000000000','d'.repeat(64)]])assert.notEqual(deploymentSignature(values[0],values[1],values[2],key),deploymentSignature(id,'1791000000000',hash,key));
  assert.throws(()=>deploymentSignature('../escape','1791000000000',hash,key));assert.throws(()=>deploymentSignature(id,'1',hash,key));
  const payload=JSON.stringify({id,commit:'c'.repeat(40),state:'succeeded',phase:'complete',errorCode:0,at:1791000000000}),signature=createHmac('sha256',Buffer.from(key,'base64')).update('result\n'+payload).digest('hex');
  assert.equal(deploymentResult(JSON.stringify({payload,signature}),key).state,'succeeded');assert.throws(()=>deploymentResult(JSON.stringify({payload:payload.replace('succeeded','failed'),signature}),key));assert.throws(()=>deploymentResult(JSON.stringify({payload,signature:'a'}),key));
});
test('deployment package paths reject traversal, alternate streams, reserved names, credentials and other services',()=>{
  for(const path of ['web/BUILD_ID','web/server/app/page.js','worker/lib/pokemon/store.ts','worker/lib/db-schema.ts','apk/release.apk'])assert.equal(deploymentPath(path),true,path);
  for(const path of ['web/../data/file','web/.env.local','web/C:/x','web/CON.txt','web/server/foo.','worker/scripts/other.ts','worker/lib/admin-helper/client.ts','apk/other.apk','https/file','web//file','web\\file','web/x:y','web/%2e%2e/file','web/foo/../../.env.local'])assert.equal(deploymentPath(path),false,path);
});
test('deployment broker is separate, non-admin, replay-safe and cannot invoke a shell or alter service configuration',()=>{
  const native=source('deployment/NasDeployer.cs');assert.match(native,/identity\.IsSystem\|\|new WindowsPrincipal/);assert.match(native,/NT SERVICE\\WydrianDeployer/);assert.match(native,/name!="WydrianDashboard"&&name!="WydrianPokemon"/);assert.match(native,/interrupted-no-retry/);assert.match(native,/jobs\.Exists\(job=>job\.id==id\)/);assert.match(native,/Artifact hash changed/);assert.match(native,/info\.links!=1/);assert.match(native,/Redirected file rejected/);assert.match(native,/APK downgrade\/version reuse rejected/);assert.match(native,/Rollback uncertain/);
  assert.doesNotMatch(native,/ChangeServiceConfig|CreateService|cmd\.exe|powershell\.exe|ProcessStartInfo\([^,]*request/i);
  assert.match(source('scripts/Install-Deployer.ps1'),/privs \$name SeChangeNotifyPrivilege/);assert.match(source('scripts/Install-Deployer.ps1'),/config WydrianDashboard obj= 'NT SERVICE\\WydrianDashboard'/);assert.match(source('scripts/Install-Deployer.ps1'),/NoPropagateInherit,InheritOnly/);
  assert.match(source('scripts/Prepare-Deployment.mjs'),/Build-Dashboard\.ps1/);assert.match(source('scripts/Prepare-Deployment.mjs'),/--test/);assert.match(source('scripts/Prepare-Deployment.mjs'),/--noEmit/);assert.match(source('scripts/Prepare-Deployment.mjs'),/finally\{writeFileSync\('next-env.d.ts',declarations\)/);
  assert.match(source('docs/admin-helper.md'),/Kizárólag a négy/);assert.match(source('admin-helper/NasAdminHelper.cs'),/owner-confirmed/);
});
