import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name:string)=>readFileSync(new URL('../scripts/'+name,import.meta.url),'utf8');
test('original OpenCode boot startup preserves user/profile, rejects overrides and never replaces a live service',()=>{
  const runner=source('Start-OriginalOpenCode.ps1');
  for(const guard of ['ExpectedSettingsSha256','userSid','USERPROFILE','S-1-5-18','OPENCODE_DB','XDG_CONFIG_HOME','cliSha256','existing profile required','existing process unhealthy','port occupied'])assert.ok(runner.includes(guard));
  assert.match(runner,/http:\/\/127\.0\.0\.1:49374/);assert.match(runner,/\/api\/info/);assert.match(runner,/\$info\.pid -eq \$record\.pid/);assert.match(runner,/-ArgumentList 'service start'/);assert.ok(runner.indexOf('if(-not $alreadyRunning)')<runner.indexOf("-ArgumentList 'service start'"));
  assert.doesNotMatch(runner,/service (?:stop|restart|set|unset)|Stop-Process|Stop-Service|Remove-Item|OPENCODE_DB\s*=|--standalone|0\.0\.0\.0/);
});
test('owner-installed task starts at boot with original password logon and limited privileges, not SYSTEM/S4U',()=>{
  const installer=source('Install-OpenCodeStartup.ps1');
  assert.match(installer,/New-ScheduledTaskTrigger -AtStartup/);assert.match(installer,/Delay='PT30S'/);assert.match(installer,/-LogonType Password -RunLevel Limited/);assert.match(installer,/Get-Credential/);assert.match(installer,/GetNetworkCredential\(\)\.Password/);assert.match(installer,/\$credential=\$null/);assert.match(installer,/MultipleInstances IgnoreNew/);assert.match(installer,/refusing overwrite/);
  assert.match(installer,/batchContextNoOpPassed=\$true;realRebootNotYetTested=\$true/);assert.match(installer,/Unregister-ScheduledTask -TaskName \$name -Confirm:\$false/);
  assert.doesNotMatch(installer,/-LogonType (?:S4U|ServiceAccount)|-RunLevel Highest|-User(?:Id)? ['"]SYSTEM|Restart-Computer|service (?:stop|restart|set|unset)|Stop-Process/);
  assert.ok(installer.indexOf('if($CheckOnly)')<installer.indexOf('$credential=Get-Credential'));
});
