param([Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBinarySha256)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'One-time local UAC approval is required.'}
$name='WydrianAdminHelper'
$root=Join-Path $env:ProgramFiles 'Wydrian NAS Admin Helper'
$source=Join-Path $project '.runtime\admin-helper-build\WydrianAdminHelper.exe'
$targets=@('WydrianDashboard','WydrianHttps','WydrianPokemon','WydrianOpenCodeGateway')
if(Get-Service $name -ErrorAction SilentlyContinue){throw 'The helper already exists; do not overwrite it.'}
if(Test-Path -LiteralPath $root){throw 'Protected helper folder already exists; do not overwrite it.'}
if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $ExpectedBinarySha256){throw 'The tested helper binary changed.'}
if(Get-NetTCPConnection -State Listen -LocalPort 3102 -ErrorAction SilentlyContinue){throw 'Loopback helper port is already occupied.'}
foreach($target in $targets){$service=Get-CimInstance Win32_Service -Filter "Name='$target'";if(-not $service -or $service.PathName.Trim('"') -ne (Join-Path $project ".runtime\services\$target.exe")){throw "Target service does not belong to this project: $target"}}
$existingUrl=(& netsh.exe http show urlacl url=http://127.0.0.1:3102/ 2>&1 | Out-String)
if($existingUrl -match 'http://127\.0\.0\.1:3102/'){throw 'The helper HTTP reservation already exists; do not overwrite it.'}
New-Item -ItemType Directory -Path $root | Out-Null
& icacls.exe $root /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect helper installation.'}
$binary=Join-Path $root 'WydrianAdminHelper.exe'
Copy-Item -LiteralPath $source -Destination $binary
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -ne $ExpectedBinarySha256){throw 'Protected helper copy failed verification.'}
$sc=Join-Path $env:WINDIR 'System32\sc.exe'
$changed=@();$created=$false;$urlCreated=$false
function Read-ServiceDescriptor([string]$serviceName) {
  $lines=@(& $sc sdshow $serviceName)
  if($LASTEXITCODE -ne 0){throw 'Could not read service security descriptor.'}
  $sddl=($lines | Where-Object {$_ -match '^(?:O:|G:|D:)'} | Select-Object -First 1)
  if(-not $sddl){throw 'Missing service security descriptor.'}
  return [System.Security.AccessControl.RawSecurityDescriptor]::new($sddl)
}
try{
  # Created Manual and never started as SYSTEM; immediately switch to its virtual, non-admin account.
  New-Service -Name $name -DisplayName 'Wydrian restricted admin helper' -BinaryPathName ('"'+$binary+'"') -StartupType Manual -Description 'Only fixed NAS service restart requests; separate owner approval; no shell or deployment.' | Out-Null
  $created=$true
  & $sc config $name obj= "NT SERVICE\$name" start= delayed-auto | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot configure the dedicated helper service account.'}
  & $sc sidtype $name unrestricted | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot configure the helper service SID.'}
  # A service account otherwise inherits SeImpersonatePrivilege from SERVICE.
  # Retain only filesystem traversal; the SCM ACL grants supply restart rights.
  & $sc privs $name SeChangeNotifyPrivilege | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot restrict helper token privileges.'}
  $service=Get-CimInstance Win32_Service -Filter "Name='$name'"
  if($service.StartName -ne "NT SERVICE\$name" -or $service.PathName -ne ('"'+$binary+'"')){throw 'Unexpected helper account or unquoted binary path.'}
  $account=New-Object Security.Principal.NTAccount "NT SERVICE\$name"
  $sid=$account.Translate([Security.Principal.SecurityIdentifier])
  & icacls.exe $root /grant "*$($sid.Value):(OI)(CI)RX" | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot grant helper executable read/execute access.'}
  $data=Join-Path $root 'data'
  New-Item -ItemType Directory -Path $data | Out-Null
  & icacls.exe $data /grant "*$($sid.Value):(OI)(CI)M" | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot grant helper private-state access.'}
  $envFile=Join-Path $project '.env.local'
  $envText=[IO.File]::ReadAllText($envFile)
  $owner=[regex]::Match($envText,'(?m)^ALLOWED_EMAIL=(.*)$').Groups[1].Value.Trim().Trim('"',"'").ToLowerInvariant()
  if(-not $owner){$owner='wydrian@gmail.com'}
  if($owner -notmatch '^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$'){throw 'Invalid owner email.'}
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try{$control=New-Object byte[] 32;$request=New-Object byte[] 32;$rng.GetBytes($control);$rng.GetBytes($request)}finally{$rng.Dispose()}
  $credentials=@{key=[Convert]::ToBase64String($control);requestKey=[Convert]::ToBase64String($request);owner=$owner}
  [IO.File]::WriteAllText((Join-Path $root 'credentials.json'),($credentials|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  $backups=@{}
  foreach($target in $targets){
    $descriptor=Read-ServiceDescriptor $target
    $backups[$target]=$descriptor.GetSddlForm([Security.AccessControl.AccessControlSections]::All)
    # Only QUERY_STATUS(4), START(16), STOP(32); no ChangeConfig, Delete, WRITE_DAC or WRITE_OWNER.
    $ace=[System.Security.AccessControl.CommonAce]::new([Security.AccessControl.AceFlags]::None,[Security.AccessControl.AceQualifier]::AccessAllowed,0x34,$sid,$false,$null)
    $descriptor.DiscretionaryAcl.InsertAce($descriptor.DiscretionaryAcl.Count,$ace)
    $sddl=$descriptor.GetSddlForm([Security.AccessControl.AccessControlSections]::All)
    & $sc sdset $target $sddl | Out-Null
    if($LASTEXITCODE -ne 0){throw "Cannot delegate the exact restart rights for $target"}
    $changed+=$target
  }
  [IO.File]::WriteAllText((Join-Path $root 'service-acl-before.json'),($backups|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  # Even a local filtered admin token must not own/retake the protected broker files.
  & icacls.exe $root /setowner '*S-1-5-18' /T | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot pin protected installation ownership to SYSTEM.'}
  & netsh.exe http add urlacl url=http://127.0.0.1:3102/ "user=NT SERVICE\$name" listen=yes delegate=no | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot reserve the loopback HTTP prefix for the helper.'}
  $urlCreated=$true
  if(-not [Diagnostics.EventLog]::SourceExists($name)){New-EventLog -LogName Application -Source $name}
  Start-Service $name
  $client=Join-Path $project '.runtime\admin-helper-client'
  if(Test-Path -LiteralPath $client){throw 'Request-only credential directory already exists; do not overwrite it.'}
  New-Item -ItemType Directory -Path $client | Out-Null
  $me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $client /inheritance:r /grant:r "${me}:(OI)(CI)R" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Cannot protect the request-only credential.'}
  [IO.File]::WriteAllText((Join-Path $client 'request.json'),(@{key=$credentials.requestKey}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  # This flag exposes only the owner UI. Full-control credential stays exclusively in protected Program Files.
  $updated=if($envText -match '(?m)^ADMIN_HELPER_ENABLED='){[regex]::Replace($envText,'(?m)^ADMIN_HELPER_ENABLED=.*$','ADMIN_HELPER_ENABLED=true')}else{$envText+"`r`nADMIN_HELPER_ENABLED=true`r`n"}
  [IO.File]::WriteAllText($envFile,$updated,(New-Object Text.UTF8Encoding $false))
  [IO.File]::WriteAllText((Join-Path $root 'installation.json'),(@{installedAt=(Get-Date).ToUniversalTime().ToString('o');binarySha256=$ExpectedBinarySha256;service=$name;account=$service.StartName;targets=$targets;port=3102}|ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
  Get-Service $name | Select-Object Name,Status
}catch{
  if($created){Stop-Service $name -ErrorAction SilentlyContinue;Set-Service $name -StartupType Disabled -ErrorAction SilentlyContinue}
  foreach($target in $changed){
    # Remove only our exact grant; preserve any other administrator's concurrent ACL changes.
    $descriptor=Read-ServiceDescriptor $target
    for($i=$descriptor.DiscretionaryAcl.Count-1;$i -ge 0;$i--){$ace=$descriptor.DiscretionaryAcl[$i];if($ace -is [Security.AccessControl.CommonAce] -and $ace.SecurityIdentifier -eq $sid -and $ace.AccessMask -eq 0x34 -and $ace.AceQualifier -eq [Security.AccessControl.AceQualifier]::AccessAllowed){$descriptor.DiscretionaryAcl.RemoveAce($i)}}
    $sddl=$descriptor.GetSddlForm([Security.AccessControl.AccessControlSections]::All)
    & $sc sdset $target $sddl | Out-Null
  }
  if($urlCreated){& netsh.exe http delete urlacl url=http://127.0.0.1:3102/ | Out-Null}
  throw
}finally{
  if($control){[Array]::Clear($control,0,$control.Length)}
  if($request){[Array]::Clear($request,0,$request.Length)}
}
