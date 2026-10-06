import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name:string)=>readFileSync(new URL('../scripts/'+name,import.meta.url),'utf8');
test('media boot runner preserves original user/data and refuses duplicate or unrelated process launches',()=>{
  const runner=source('Start-MediaServers.ps1');
  for(const text of ['ExpectedSettingsSha256','userSid','USERPROFILE','LOCALAPPDATA','S-1-5-18','com.plexapp.plugins.library.db','data\\jellyfin.db','different Jellyfin data/arguments','port occupied by another process','GetOwnerSid'])assert.ok(runner.includes(text),text);
  assert.match(runner,/machineIdentifier -eq \$server\.serverId/);assert.match(runner,/if\(\$CheckOnly -or \$state\.running\)/);assert.match(runner,/\$state\.pid -eq \$launched\.Id/);
  assert.doesNotMatch(runner,/Stop-Process|Stop-Service|Restart-Service|Remove-Item|New-Item|Set-ItemProperty|Register-ScheduledTask|ServerCertificateValidationCallback/);
});
test('both media targets are attempted independently and reports distinguish API from listener verification',()=>{
  const runner=source('Start-MediaServers.ps1');
  assert.match(runner,/foreach\(\$server in \$settings\.servers\)/);assert.match(runner,/catch \{\$results\+=/);assert.match(runner,/process-owner-port-and-server-identity/);assert.match(runner,/process-owner-datadir-and-listener/);
});
test('media task preparation never registers tasks or takes credentials and uses password logon without elevated server privileges',()=>{
  const prepare=source('Prepare-MediaStartup.ps1');
  assert.match(prepare,/Principal\.LogonType=1/);assert.match(prepare,/Principal\.RunLevel=0/);assert.match(prepare,/Triggers\.Create\(8\)/);assert.match(prepare,/Delay='PT60S'/);assert.match(prepare,/MultipleInstances=2/);assert.match(prepare,/ExecutionTimeLimit='PT0S'/);
  assert.doesNotMatch(prepare,/Get-Credential|Register-ScheduledTask|\.RegisterTask|Stop-Process|Restart-Service|Remove-Item|Set-ItemProperty|Restart-Computer/);assert.match(prepare,/loginStartupEntriesUntouched=\$true/);
  assert.ok(prepare.indexOf('if($CheckOnly)')<prepare.indexOf('New-Item -ItemType Directory'));
});
