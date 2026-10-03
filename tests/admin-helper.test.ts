import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN_TARGETS,adminTarget,helperId,adminBody,helperHeaders,helperResponseSignature,verifyHelperResponse,DASHBOARD_ORIGIN } from '../lib/admin-helper/protocol.ts';
import { helperCall,HelperError } from '../lib/admin-helper/client.ts';
const key=Buffer.alloc(32).toString('base64'),nonce='a'.repeat(43);
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function request(data:unknown,headers:Record<string,string>={}){return new Request(DASHBOARD_ORIGIN+'/api/admin-helper',{method:'POST',headers:{origin:DASHBOARD_ORIGIN,'content-type':'application/json',...headers},body:JSON.stringify(data)});}
test('admin helper: only four exact targets; no arbitrary service/command/path or original OpenCode',()=>{
  assert.deepEqual(ADMIN_TARGETS.map(target=>target.id),['dashboard','https','pokemon','opencode-gateway']);
  for(const target of ADMIN_TARGETS)assert.equal(adminTarget(target.id),target.id);
  for(const value of ['WydrianDashboard','opencode','helper','C:\\evil.ps1','dashboard & whoami',null,{},'Dashboard'])assert.throws(()=>adminTarget(value));
  assert.equal(helperId(nonce),nonce);for(const id of ['../x','',null,nonce+'x'])assert.throws(()=>helperId(id));
});
test('admin helper: mutation requires same-origin JSON, bounded exact schema and typed confirmation',async()=>{
  assert.deepEqual(await adminBody(request({action:'request',target:'dashboard'})),{action:'request',target:'dashboard'});
  for(const data of [{action:'restart',target:'dashboard'},{action:'request',target:'dashboard',command:'whoami'},{action:'confirm',id:nonce,confirmation:'WydrianDashboard',target:'https'},{action:'review',id:'fake'},[],null])await assert.rejects(adminBody(request(data)));
  const invalidHeaders:Record<string,string>[]=[{origin:'https://opencode.nas.wydrian.hu'},{origin:'https://evil.example'},{origin:''},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'},{'content-length':'5000'}];
  for(const headers of invalidHeaders)await assert.rejects(adminBody(request({action:'request',target:'dashboard'},headers)));
  await assert.rejects(adminBody(request({action:'request',target:'dashboard',extra:'x'.repeat(2000)})));
  assert.equal((await adminBody(request({action:'confirm',id:nonce,confirmation:'WydrianDashboard'}))).confirmation,'WydrianDashboard');
  await assert.rejects(adminBody(request({action:'confirm',id:nonce,confirmation:'RESTART'})));
});
test('admin helper: cross-language HMAC vectors bind role/method/path/body/time/nonce and responses',()=>{
  const body='{"target":"dashboard"}',headers=helperHeaders('POST','/v1/request',body,key,'control',1791000000000,nonce);
  assert.equal(headers['X-Nas-Signature'],'1b1c690c07bbe38a93be960d83838aebfc73ecfda81396125bfe7ebfe2e35ab6');
  for(const [method,path,text,role] of [['GET','/v1/request',body,'control'],['POST','/v1/confirm',body,'control'],['POST','/v1/request','{}','control'],['POST','/v1/request',body,'request']] as const)assert.notEqual(helperHeaders(method,path,text,key,role,1791000000000,nonce)['X-Nas-Signature'],headers['X-Nas-Signature']);
  assert.throws(()=>helperHeaders('POST','/v1/request',body,'bad','request'));
  const signature=helperResponseSignature(200,'{"available":true}',key,'control',nonce);assert.equal(signature,'69dd47c39dec9f336619f7dfd13819bd1a490d90c8ae67b0a0625832e32d2681');
  assert.ok(verifyHelperResponse(200,'{"available":true}',key,'control',nonce,signature));
  for(const value of [null,'forged',signature.slice(0,-2)+'00'])assert.equal(verifyHelperResponse(200,'{}',key,'control',nonce,value),false);
  assert.equal(verifyHelperResponse(200,'{"available":true}',key,'control','b'.repeat(43),signature),false);
});
test('admin helper: server client signs requests, checks response authentication and does not follow redirects',async()=>{
  const fakeFetch:typeof fetch=async(input,options)=>{
    assert.equal(String(input),'http://127.0.0.1:9999/v1/status');assert.equal(options?.redirect,'manual');assert.equal(options?.cache,'no-store');
    const headers=new Headers(options?.headers);assert.equal(headers.get('x-nas-role'),'control');assert.equal(headers.get('cookie'),null);
    const body='{"available":true,"targets":[],"jobs":[]}';return new Response(body,{headers:{'X-Nas-Response':helperResponseSignature(200,body,key,'control',headers.get('x-nas-nonce')!)}});
  };
  assert.equal((await helperCall('/v1/status',undefined,{credentials:{key},origin:'http://127.0.0.1:9999',fetch:fakeFetch}) as {available:boolean}).available,true);
  await assert.rejects(helperCall('/v1/status',undefined,{credentials:{key},origin:'http://127.0.0.1:9999',fetch:async()=>new Response('{"available":true}')}) as Promise<unknown>,HelperError);
  for(const status of [409,410,429,500]){
    await assert.rejects(helperCall('/v1/status',undefined,{credentials:{key},origin:'http://127.0.0.1:9999',fetch:async(input,options)=>{const h=new Headers(options?.headers),body='{"error":"request_rejected"}';return new Response(body,{status,headers:{'X-Nas-Response':helperResponseSignature(status,body,key,'control',h.get('x-nas-nonce')!)}});}}),(error:unknown)=>error instanceof HelperError && error.status===(status===500?503:status));
  }
});
test('admin helper: UI/API owner guards, credentials and CLI do not grant agent approval capability',()=>{
  const route=source('app/api/admin-helper/route.ts');assert.match(route,/requireOpenCodeIdentity/);assert.match(route,/getToken/);assert.match(route,/createHash\('sha256'\)\.update\(raw\)/);assert.match(route,/adminBody\(request\)/);
  const page=source('app/config/page.tsx');assert.match(page,/isOpenCodeOwner\(session.user\?\.email\) && <AdminHelper/);
  const ui=source('app/config/admin-helper.tsx');assert.match(ui,/phrase!==review.service/);assert.match(ui,/action:'review'/);assert.match(ui,/action:'confirm'/);assert.doesNotMatch(ui,/credentials\.json|requestKey|X-Nas-Signature/);
  const cli=source('scripts/Request-AdminRestart.mjs');assert.match(cli,/admin-helper-client\/request.json/);assert.match(cli,/'request'/);assert.doesNotMatch(cli,/\/v1\/confirm|\/v1\/review|credentials\.json/);
  assert.doesNotMatch(source('lib/admin-helper/policy.ts'),/node:|next-auth/);
});
test('admin helper: native service has no process/shell/config runner, minimum delegated service rights and crash-safe no-retry',()=>{
  const native=source('admin-helper/NasAdminHelper.cs'),installer=source('scripts/Install-AdminHelper.ps1');
  assert.doesNotMatch(native,/Process\.Start|cmd\.exe|powershell\.exe|CreateService|ChangeServiceConfig|SetServiceObjectSecurity/);
  assert.match(native,/Query\|Start\|Stop/);assert.match(native,/StartService\(handle,0,IntPtr.Zero\)/);assert.match(native,/identity.IsSystem/);assert.match(native,/IsInRole\(WindowsBuiltInRole.Administrator\)/);
  assert.match(native,/job.state="uncertain"/);assert.match(native,/recovery-no-retry/);assert.match(native,/job.state!="queued"\)return/);assert.match(native,/sessionHash!=Policy.Value/);
  assert.match(installer,/0x34/);assert.match(installer,/NT SERVICE\\\$name/);assert.match(installer,/ProgramFiles/);assert.match(installer,/\/setowner '\*S-1-5-18'/);
  assert.match(installer,/privs \$name SeChangeNotifyPrivilege/);
});
