import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dashboardOrigin,dashboardRequestOrigin,dashboardSameOrigin,DASHBOARD_ORIGINS} from '../lib/dashboard-origin.ts';
import {adminBody} from '../lib/admin-helper/protocol.ts';
import {parseZeroSslEab,zeroSslSnippet} from '../lib/tls/zerossl-eab.ts';
test('dashboard origins are exactly two HTTPS hosts, never arbitrary sibling hosts, HTTP, ports or wildcard matches',()=>{
  for(const origin of DASHBOARD_ORIGINS){assert.equal(dashboardOrigin(origin),origin);assert.equal(dashboardRequestOrigin(new Headers({'x-forwarded-host':new URL(origin).host,'x-forwarded-proto':'https'})),origin);}
  for(const origin of ['http://wydrian.hu','https://www.wydrian.hu','https://opencode.nas.wydrian.hu','https://wydrian.hu:443','https://wydrian.hu.evil.example','https://user@wydrian.hu',null])assert.throws(()=>dashboardOrigin(origin));
  const invalidHeaders:Record<string,string>[]=[{'host':'wydrian.hu','x-forwarded-proto':'http'},{'x-forwarded-host':'wydrian.hu, evil.example','x-forwarded-proto':'https'},{'host':'evil.example','x-forwarded-proto':'https'},{'host':'wydrian.hu'}];
  for(const headers of invalidHeaders)assert.throws(()=>dashboardRequestOrigin(new Headers(headers)));
});
test('admin-helper remains same-origin on both dashboard hosts; cross-host/sibling-origin mutation is rejected',async()=>{
  for(const origin of DASHBOARD_ORIGINS){const request=new Request(origin+'/api/admin-helper',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'request',target:'https'})});assert.ok(dashboardSameOrigin(request));assert.equal((await adminBody(request)).target,'https');}
  for(const origin of ['https://nas.wydrian.hu','https://evil.example','https://opencode.nas.wydrian.hu','http://wydrian.hu','']){const request=new Request('https://wydrian.hu/api/admin-helper',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"action":"request","target":"https"}'});assert.equal(dashboardSameOrigin(request),false);await assert.rejects(adminBody(request));}
  assert.equal(dashboardSameOrigin(new Request('https://wydrian.hu/',{headers:{origin:'https://wydrian.hu','sec-fetch-site':'cross-site'}})),false);
});
test('dual auth normalizes HTTPS callback URLs, guards lazy auth/actions and keeps original OpenCode/mobile trust boundaries',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),auth=source('auth.ts');assert.match(auth,/dashboardRequestOrigin\(request\?\.headers \|\| await headers\(\)\)/);assert.match(auth,/process\.env\.AUTH_URL\|\|process\.env\.NEXTAUTH_URL/);assert.match(auth,/new NextRequest\(origin\+request\.nextUrl\.pathname\+request\.nextUrl\.search,request\)/);
  assert.match(source('app/opencode/page.tsx'),/redirect\('https:\/\/nas\.wydrian\.hu\/opencode'\)/);assert.match(source('lib/opencode-policy.ts'),/OPENCODE_COOKIE_DOMAIN='nas\.wydrian\.hu'/);assert.match(source('lib/mobile/store.ts'),/MOBILE_ORIGIN='https:\/\/nas\.wydrian\.hu'/);assert.match(source('next.config.ts'),/\.\/cert\/\*\*\/\*/);assert.match(source('.gitignore'),/\/cert\//);
});
test('ZeroSSL EAB parser accepts the two-line private input but rejects injection and bad HMAC without leaking inputs',()=>{
  const id='a'.repeat(22),mac=Buffer.alloc(64,1).toString('base64url'),parsed=parseZeroSslEab('\uFEFF'+id+'\r\n'+mac+'\r\n');assert.deepEqual(parsed,{keyId:id,hmacKey:mac});
  const snippet=zeroSslSnippet(parsed);assert.match(snippet,/dir https:\/\/acme\.zerossl\.com\/v2\/DV90/);assert.match(snippet,/disable_tlsalpn_challenge/);assert.doesNotMatch(snippet,/disable_http_challenge|api\.zerossl/);
  for(const input of [id+'\nshort',id+'\n'+mac+'\nextra',id+'; injected\n'+mac,'{invalid json}',id+'\n'+'x'.repeat(300)])assert.throws(()=>parseZeroSslEab(input),(error:unknown)=>error instanceof Error&&!error.message.includes(input));
});
test('owner activation is narrowly scoped, preserves rollback and never kills HTTP.sys or expands delegated helper targets',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),activation=source('scripts/Activate-ApexHttps.ps1'),retire=source('scripts/Remove-IisAfterApex.ps1');
  assert.match(activation,/ExpectedConfigSha256/);assert.match(activation,/ExpectedPreviousSha256/);assert.match(activation,/Default Web Site/);assert.match(activation,/Set-Service -Name W3SVC -StartupType Manual/);assert.match(activation,/Stop-Service -Name W3SVC/);assert.match(activation,/Restart-Service -Name WydrianHttps/);assert.match(activation,/previous\.Caddyfile/);assert.doesNotMatch(activation,/Stop-Process|Stop-Service.*\bWAS\b|Restart-Computer|Remove-WebSite/);
  assert.match(activation,/Start-Process -FilePath \$caddy.*-RedirectStandardOutput.*-RedirectStandardError/);assert.match(activation,/\$validation\.ExitCode -ne 0/);assert.match(activation,/phase='validation';iisUntouched=\$true;httpsUntouched=\$true/);assert.doesNotMatch(activation,/& \$caddy validate/);assert.ok(activation.indexOf('$validation.ExitCode')<activation.indexOf('Stop-Service -Name W3SVC'));
  assert.match(retire,/FeatureName -like 'IIS-\*'/);assert.match(retire,/Disable-WindowsOptionalFeature.*-NoRestart/);assert.doesNotMatch(retire,/Restart-Computer|\s-Remove\b/);assert.match(retire,/configurationBackupPreserved/);
});
