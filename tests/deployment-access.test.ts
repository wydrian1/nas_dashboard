import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('deployment preparation checks dashboard runtime access before build and again before packaging',()=>{
  const source=readFileSync(new URL('../scripts/Prepare-Deployment.mjs',import.meta.url),'utf8');
  const first=source.indexOf("-File','scripts/Test-Deployment-Access.ps1'"),second=source.lastIndexOf("-File','scripts/Test-Deployment-Access.ps1'");
  assert.ok(first>0&&first<source.indexOf("-File','scripts/Build-Dashboard.ps1'"));assert.ok(second>first&&second<source.indexOf('const id=randomBytes'));
  assert.doesNotMatch(readFileSync(new URL('../scripts/Test-Deployment-Access.ps1',import.meta.url),'utf8'),/Set-Acl|icacls|Start-Service|Stop-Service|Restart-Service/);
});
test('Windows deployment access preflight is read-only and rejects a recreated unreadable config or deny ACE',{skip:process.platform!=='win32'},()=>{
  const root=process.cwd(),fixture=mkdtempSync(join(root,'.runtime/research/deployment-access-test-'));
  const powershell=join(process.env.WINDIR!,'System32/WindowsPowerShell/v1.0/powershell.exe'),script=join(root,'scripts/Test-Deployment-Access.ps1');
  const run=(args:string[])=>spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...args],{encoding:'utf8',timeout:30000,windowsHide:true});
  const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
  const paths=['next.config.ts','tsconfig.json','next-env.d.ts','package.json','.env.local','.runtime/services/WydrianDashboard.xml','.runtime/services/WydrianDashboard.exe'];
  try{
    for(const path of paths){mkdirSync(join(fixture,path,'..'),{recursive:true});writeFileSync(join(fixture,path),'synthetic prerequisite');}
    const grant=run(['-Command',`$ErrorActionPreference='Stop';$root=${quote(fixture)};$sid=[Security.Principal.NTAccount]::new('NT SERVICE\\WydrianDashboard').Translate([Security.Principal.SecurityIdentifier]);foreach($path in @(${paths.map(quote).join(',')})){$file=Join-Path $root $path;$acl=Get-Acl -LiteralPath $file;$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'ReadAndExecute','Allow'));Set-Acl -LiteralPath $file -AclObject $acl}`]);assert.equal(grant.status,0,grant.stderr);
    let result=run(['-File',script,'-ProjectPath',fixture]);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).dashboardReadPrerequisites,7);
    const config=join(fixture,'next.config.ts'),before=readFileSync(config,'utf8');
    const revoke=run(['-Command',`$ErrorActionPreference='Stop';$file=${quote(config)};$acl=Get-Acl -LiteralPath $file;$sid=[Security.Principal.NTAccount]::new('NT SERVICE\\WydrianDashboard').Translate([Security.Principal.SecurityIdentifier]);$acl.PurgeAccessRules($sid);Set-Acl -LiteralPath $file -AclObject $acl`]);assert.equal(revoke.status,0,revoke.stderr);
    result=run(['-File',script,'-ProjectPath',fixture]);assert.notEqual(result.status,0);assert.match(result.stderr,/Missing explicit dashboard read\/execute access: next.config.ts/);assert.equal(readFileSync(config,'utf8'),before);
    const deny=run(['-Command',`$ErrorActionPreference='Stop';$file=${quote(config)};$acl=Get-Acl -LiteralPath $file;$sid=[Security.Principal.NTAccount]::new('NT SERVICE\\WydrianDashboard').Translate([Security.Principal.SecurityIdentifier]);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'ReadAndExecute','Allow'));$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'Read','Deny'));Set-Acl -LiteralPath $file -AclObject $acl`]);assert.equal(deny.status,0,deny.stderr);
    result=run(['-File',script,'-ProjectPath',fixture]);assert.notEqual(result.status,0);assert.match(result.stderr,/Dashboard runtime access denied: next.config.ts/);assert.equal(readFileSync(config,'utf8'),before);
  }finally{rmSync(fixture,{recursive:true,force:true});}
});
