param([Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBinarySha256)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
if($project -ne 'D:\!nas'){throw 'Only the active D: project is supported.'}
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'One-time owner UAC approval required.'}
$name='WydrianDeployer';$root=Join-Path $env:ProgramFiles 'Wydrian NAS Deployer';$area=Join-Path $project '.runtime\deployment';$client=Join-Path $project '.runtime\deployment-client'
$source=Join-Path $project '.runtime\deployer-build\WydrianDeployer.exe'
$sc=Join-Path $env:WINDIR 'System32\sc.exe'
if((Get-FileHash $source -Algorithm SHA256).Hash -ne $ExpectedBinarySha256){throw 'Tested broker binary changed.'}
if((Get-Service $name -ErrorAction SilentlyContinue) -or (Test-Path $root) -or (Test-Path $area) -or (Test-Path $client)){throw 'Existing deployment installation must not be overwritten.'}
$targets=@('WydrianDashboard','WydrianPokemon')
foreach($target in $targets){$service=Get-CimInstance Win32_Service -Filter "Name='$target'";if(-not $service -or $service.State -ne 'Running' -or $service.PathName.Trim('"') -ne (Join-Path $project ".runtime\services\$target.exe")){throw "Unexpected target: $target"}}
$dashboard=Get-CimInstance Win32_Service -Filter "Name='WydrianDashboard'"
if($dashboard.StartName -notin @('LocalSystem','NT SERVICE\WydrianDashboard')){throw 'Unknown dashboard account; review before migration.'}
$worker=Get-CimInstance Win32_Service -Filter "Name='WydrianPokemon'"
if($worker.StartName -ne 'NT AUTHORITY\LocalService'){throw 'Worker must already be non-admin LocalService.'}
$dashboardXml=Join-Path $project '.runtime\services\WydrianDashboard.xml';$workerXml=Join-Path $project '.runtime\services\WydrianPokemon.xml'
$oldDashboardXml=[IO.File]::ReadAllText($dashboardXml);$oldAccount=$dashboard.StartName
$node=Get-ChildItem (Join-Path $project '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
$tools=Join-Path $project '.runtime\android-tools';$jdk=Get-ChildItem $tools -Directory -Filter 'jdk-*' | Select-Object -First 1
$buildTools=Join-Path $tools 'sdk\build-tools\35.0.0'
foreach($file in @((Join-Path $node.FullName 'node.exe'),(Join-Path $jdk.FullName 'bin\java.exe'),(Join-Path $buildTools 'lib\apksigner.jar'),(Join-Path $buildTools 'aapt.exe'))){if(-not(Test-Path $file)){throw 'Pinned local verification runtime missing.'}}
$env:JAVA_HOME=$jdk.FullName;$env:PATH="$($jdk.FullName)\bin;$env:PATH"
$signature=& (Join-Path $buildTools 'apksigner.bat') verify --print-certs (Join-Path $project '.runtime\artifacts\Wydrian-NAS-1.0.0.apk')
if($LASTEXITCODE -ne 0){throw 'Current production APK signature invalid.'}
$signer=@($signature | Select-String '^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]{64})$')
if($signer.Count -ne 1){throw 'Exactly one existing APK signer required.'}
$signerHash=$signer[0].Matches[0].Groups[1].Value.ToLower()
$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$created=$false;$accountChanged=$false;$changed=@();$grants=@();$dashboardStopped=$false
function ServiceDescriptor([string]$target){$lines=@(& $sc sdshow $target);if($LASTEXITCODE -ne 0){throw 'Cannot read service DACL.'};$text=$lines | Where-Object {$_ -match '^(O:|G:|D:)'} | Select-Object -First 1;return [Security.AccessControl.RawSecurityDescriptor]::new($text)}
function Grant([string]$path,[Security.Principal.SecurityIdentifier]$sid,[Security.AccessControl.FileSystemRights]$rights,[bool]$children=$false){
  $acl=Get-Acl -LiteralPath $path;$inherit=if($children){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,$rights,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
  $existing=@($acl.Access | Where-Object {-not $_.IsInherited -and $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]) -eq $sid -and $_.FileSystemRights -eq $rights -and $_.InheritanceFlags -eq $inherit -and $_.AccessControlType -eq 'Allow'})
  if(-not $existing.Count){$acl.AddAccessRule($rule);Set-Acl -LiteralPath $path -AclObject $acl;$script:grants+=@{path=$path;rule=$rule}}
}
function Protect([string]$path,[string[]]$entries){& icacls.exe $path /inheritance:r /grant:r $entries | Out-Null;if($LASTEXITCODE -ne 0){throw "Cannot protect $path"}}
try{
  New-Item -ItemType Directory -Path $root | Out-Null
  Protect $root @('*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F')
  Copy-Item $source (Join-Path $root 'WydrianDeployer.exe')
  if((Get-FileHash (Join-Path $root 'WydrianDeployer.exe') -Algorithm SHA256).Hash -ne $ExpectedBinarySha256){throw 'Protected binary hash mismatch.'}
  Copy-Item (Join-Path $node.FullName 'node.exe') (Join-Path $root 'node.exe')
  Copy-Item (Join-Path $project 'scripts\Deployment-Database.mjs') (Join-Path $root 'Deployment-Database.mjs')
  Copy-Item -Recurse $jdk.FullName (Join-Path $root 'jdk')
  Copy-Item (Join-Path $buildTools 'lib\apksigner.jar') (Join-Path $root 'apksigner.jar')
  Copy-Item (Join-Path $buildTools 'aapt.exe') (Join-Path $root 'aapt.exe')
  New-Service -Name $name -DisplayName 'Wydrian restricted deployment broker' -BinaryPathName ('"'+(Join-Path $root 'WydrianDeployer.exe')+'"') -StartupType Manual -Description 'Owner-delegated sealed web/worker/signed-APK releases only; no shell or admin token.' | Out-Null
  $created=$true
  & $sc config $name obj= "NT SERVICE\$name" start= delayed-auto | Out-Null;if($LASTEXITCODE -ne 0){throw 'Broker account setup failed.'}
  & $sc sidtype $name unrestricted | Out-Null;if($LASTEXITCODE -ne 0){throw 'Broker SID setup failed.'}
  & $sc privs $name SeChangeNotifyPrivilege | Out-Null;if($LASTEXITCODE -ne 0){throw 'Broker privilege restriction failed.'}
  & $sc sidtype WydrianDashboard unrestricted | Out-Null;if($LASTEXITCODE -ne 0){throw 'Dashboard SID setup failed.'}
  $brokerSid=([Security.Principal.NTAccount]::new("NT SERVICE\$name")).Translate([Security.Principal.SecurityIdentifier]);$dashboardSid=([Security.Principal.NTAccount]::new('NT SERVICE\WydrianDashboard')).Translate([Security.Principal.SecurityIdentifier]);$localSid=[Security.Principal.SecurityIdentifier]::new('S-1-5-19')
  Grant $root $brokerSid ReadAndExecute $true
  New-Item -ItemType Directory -Path (Join-Path $root 'data') | Out-Null;Grant (Join-Path $root 'data') $brokerSid Modify $true
  New-Item -ItemType Directory -Path $area,$client | Out-Null
  Protect $area @('*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F',"*$($brokerSid.Value):(OI)(CI)RX","${me}:(OI)(CI)RX")
  foreach($folder in @('inbox','results','releases')){New-Item -ItemType Directory -Path (Join-Path $area $folder) | Out-Null}
  Grant (Join-Path $area 'inbox') ([Security.Principal.NTAccount]::new($me).Translate([Security.Principal.SecurityIdentifier])) Modify $true
  Grant (Join-Path $area 'results') $brokerSid Modify $true;Grant (Join-Path $area 'releases') $brokerSid Modify $true
  foreach($sid in @($dashboardSid,$localSid)){Grant $area $sid ([Security.AccessControl.FileSystemRights]'ReadAttributes,Traverse,Synchronize,ReadPermissions')}
  Grant (Join-Path $area 'releases') $dashboardSid ReadAndExecute $true;Grant (Join-Path $area 'releases') $localSid ReadAndExecute $true
  Protect $client @('*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F',"${me}:(OI)(CI)R")
  $keyBytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($keyBytes)}finally{$rng.Dispose()};$key=[Convert]::ToBase64String($keyBytes)
  [IO.File]::WriteAllText((Join-Path $client 'deploy.json'),(@{key=$key}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false));[Array]::Clear($keyBytes,0,$keyBytes.Length)
  # Root grants are non-inheriting traversal + directory creation, never arbitrary file writes/deletion.
  Grant $project $brokerSid ([Security.AccessControl.FileSystemRights]'CreateDirectories,ReadAttributes,Traverse,Synchronize,ReadPermissions')
  foreach($path in @((Join-Path $project '.runtime'),(Join-Path $project '.runtime\services'))){Grant $path $brokerSid ([Security.AccessControl.FileSystemRights]'ReadAttributes,Traverse,Synchronize,ReadPermissions')}
  foreach($path in @($project,(Join-Path $project '.runtime'),(Join-Path $project '.runtime\services'),(Join-Path $project 'data'))){Grant $path $dashboardSid ReadAndExecute}
  foreach($path in @((Join-Path $project 'node_modules'),(Join-Path $project 'public'),$node.FullName,(Join-Path $project '.next'))){Grant $path $dashboardSid ReadAndExecute $true}
  foreach($path in @('.env.local','package.json','next.config.ts','tsconfig.json','next-env.d.ts','.runtime\services\WydrianDashboard.xml','.runtime\services\WydrianDashboard.exe')){Grant (Join-Path $project $path) $dashboardSid ReadAndExecute}
  Grant (Join-Path $project 'data') $dashboardSid ([Security.AccessControl.FileSystemRights]'CreateFiles,ReadAttributes,Traverse,Synchronize,ReadPermissions')
  foreach($file in (Get-ChildItem (Join-Path $project 'data') -File | Where-Object {$_.Name -match '^dashboard\.sqlite(?:-wal|-shm|-journal)?$'})){Grant $file.FullName $dashboardSid Modify;Grant $file.FullName $brokerSid Read}
  # Newly created SQLite WAL/SHM files inherit writes, but subdirectories (Caddy TLS/archives) do not.
  $dataAcl=Get-Acl (Join-Path $project 'data');$sqliteRule=[Security.AccessControl.FileSystemAccessRule]::new($dashboardSid,[Security.AccessControl.FileSystemRights]::Modify,[Security.AccessControl.InheritanceFlags]::ObjectInherit,[Security.AccessControl.PropagationFlags]'NoPropagateInherit,InheritOnly',[Security.AccessControl.AccessControlType]::Allow);$dataAcl.AddAccessRule($sqliteRule);Set-Acl (Join-Path $project 'data') $dataAcl;$grants+=@{path=(Join-Path $project 'data');rule=$sqliteRule}
  Grant (Join-Path $project 'data') $brokerSid ReadAndExecute;Grant (Join-Path $project 'data\backups') $brokerSid Modify $true
  $dataAcl=Get-Acl (Join-Path $project 'data');$backupRule=[Security.AccessControl.FileSystemAccessRule]::new($brokerSid,[Security.AccessControl.FileSystemRights]::Read,[Security.AccessControl.InheritanceFlags]::ObjectInherit,[Security.AccessControl.PropagationFlags]'NoPropagateInherit,InheritOnly',[Security.AccessControl.AccessControlType]::Allow);$dataAcl.AddAccessRule($backupRule);Set-Acl (Join-Path $project 'data') $dataAcl;$grants+=@{path=(Join-Path $project 'data');rule=$backupRule}
  Grant (Join-Path $project '.next') $brokerSid Modify $true;Grant (Join-Path $project '.next\cache') $dashboardSid Modify $true
  # WinSW has fixed log locations. Only its logs (not arbitrary runtime source/config) are writable.
  Grant (Join-Path $project 'logs') $dashboardSid Modify $true
  Grant (Join-Path $project '.runtime\artifacts') $brokerSid ([Security.AccessControl.FileSystemRights]'CreateFiles,ReadAttributes,Traverse,Synchronize,ReadPermissions')
  Grant (Join-Path $project '.runtime\artifacts\Wydrian-NAS-1.0.0.apk') $brokerSid Modify
  Grant (Join-Path $project '.runtime\artifacts') $dashboardSid ReadAndExecute;Grant (Join-Path $project '.runtime\artifacts\Wydrian-NAS-1.0.0.apk') $dashboardSid Read
  Grant $workerXml $brokerSid Modify
  Grant $dashboardXml $brokerSid Read
  foreach($path in @('.runtime\secrets','.runtime\secrets\etoro.json','.runtime\secrets\firebase-service-account.json')){Grant (Join-Path $project $path) $dashboardSid Read}
  $helper=Join-Path $env:ProgramFiles 'Wydrian NAS Admin Helper';Grant $helper $dashboardSid ReadAndExecute;Grant (Join-Path $helper 'credentials.json') $dashboardSid Read
  # Ancestor attribute/traverse access only: no D: directory listing or inherited read.
  foreach($sid in @($brokerSid,$dashboardSid)){Grant 'D:\' $sid ([Security.AccessControl.FileSystemRights]'ReadAttributes,Traverse,Synchronize,ReadPermissions')}
  $descriptors=@{};foreach($target in $targets){$descriptor=ServiceDescriptor $target;$descriptors[$target]=$descriptor.GetSddlForm([Security.AccessControl.AccessControlSections]::All);$ace=[Security.AccessControl.CommonAce]::new([Security.AccessControl.AceFlags]::None,[Security.AccessControl.AceQualifier]::AccessAllowed,0x35,$brokerSid,$false,$null);$descriptor.DiscretionaryAcl.InsertAce($descriptor.DiscretionaryAcl.Count,$ace);& $sc sdset $target $descriptor.GetSddlForm([Security.AccessControl.AccessControlSections]::All) | Out-Null;if($LASTEXITCODE -ne 0){throw 'Target delegation failed.'};$changed+=$target}
  [IO.File]::WriteAllText((Join-Path $root 'service-acl-before.json'),($descriptors|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  & (Join-Path $node.FullName 'node.exe') (Join-Path $project 'scripts\Backup-Database.mjs');if($LASTEXITCODE -ne 0){throw 'Pre-account-change SQLite backup failed.'}
  [IO.File]::WriteAllText((Join-Path $root 'dashboard-before.xml'),$oldDashboardXml,(New-Object Text.UTF8Encoding $false))
  Stop-Service WydrianDashboard;$dashboardStopped=$true
  [xml]$xml=$oldDashboardXml;$accountElement=$xml.SelectSingleNode('/service/serviceaccount');if(-not $accountElement){throw 'Dashboard account XML element missing.'};$accountElement.RemoveAll();$username=$xml.CreateElement('username');$username.InnerText='NT SERVICE\WydrianDashboard';[void]$accountElement.AppendChild($username);[IO.File]::WriteAllText($dashboardXml,$xml.OuterXml,(New-Object Text.UTF8Encoding $false))
  & $sc config WydrianDashboard obj= 'NT SERVICE\WydrianDashboard' | Out-Null;if($LASTEXITCODE -ne 0){throw 'Dashboard non-admin account change failed.'};$accountChanged=$true
  & $sc privs WydrianDashboard SeChangeNotifyPrivilege | Out-Null;if($LASTEXITCODE -ne 0){throw 'Dashboard privilege restriction failed.'}
  $config=@{key=$key;node='node.exe';java='jdk\bin\java.exe';aapt='aapt.exe';signer=$signerHash;dashboardXmlHash=(Get-FileHash $dashboardXml -Algorithm SHA256).Hash.ToLower();workerTemplate=[IO.File]::ReadAllText($workerXml)}
  [IO.File]::WriteAllText((Join-Path $root 'config.json'),($config|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding $false));[IO.File]::WriteAllText((Join-Path $root 'data\worker-hash.txt'),(Get-FileHash $workerXml -Algorithm SHA256).Hash.ToLower(),(New-Object Text.UTF8Encoding $false))
  [IO.File]::WriteAllText((Join-Path $root 'installation.json'),(@{at=(Get-Date).ToUniversalTime().ToString('o');binarySha256=$ExpectedBinarySha256;account="NT SERVICE\$name";dashboardAccount='NT SERVICE\WydrianDashboard';targets=$targets;scmRights='0x35';oldDashboardAccount=$oldAccount}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  & icacls.exe $root /setowner '*S-1-5-18' /T | Out-Null;if($LASTEXITCODE -ne 0){throw 'Cannot pin protected broker ownership.'}
  Start-Service WydrianDashboard;$dashboardStopped=$false
  $healthy=$false;for($i=0;$i -lt 20;$i++){try{$response=Invoke-WebRequest 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2;if($response.StatusCode -eq 200){$healthy=$true;break}}catch{};Start-Sleep -Seconds 1};if(-not $healthy){throw 'Non-admin dashboard startup failed.'}
  if(-not [Diagnostics.EventLog]::SourceExists($name)){New-EventLog -LogName Application -Source $name}
  Start-Service $name
  Get-Service $name,WydrianDashboard,WydrianPokemon | Select-Object Name,Status
}catch{
  if($created){Stop-Service $name -ErrorAction SilentlyContinue;Set-Service $name -StartupType Disabled -ErrorAction SilentlyContinue}
  if($accountChanged -or $dashboardStopped){Stop-Service WydrianDashboard -ErrorAction SilentlyContinue;[IO.File]::WriteAllText($dashboardXml,$oldDashboardXml,(New-Object Text.UTF8Encoding $false));& $sc config WydrianDashboard obj= $oldAccount | Out-Null;Start-Service WydrianDashboard}
  foreach($target in $changed){$descriptor=ServiceDescriptor $target;for($i=$descriptor.DiscretionaryAcl.Count-1;$i -ge 0;$i--){$ace=$descriptor.DiscretionaryAcl[$i];if($ace -is [Security.AccessControl.CommonAce] -and $ace.SecurityIdentifier -eq $brokerSid -and $ace.AccessMask -eq 0x35){$descriptor.DiscretionaryAcl.RemoveAce($i)}};& $sc sdset $target $descriptor.GetSddlForm([Security.AccessControl.AccessControlSections]::All) | Out-Null}
  foreach($grant in $grants){try{$acl=Get-Acl $grant.path;$acl.RemoveAccessRuleSpecific($grant.rule);Set-Acl $grant.path $acl}catch{}}
  throw
}finally{$key=$null}
