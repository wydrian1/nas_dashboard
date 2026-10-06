# Explicit owner/UAC approval only. Does not grant broader rights to the deployment or restart helpers.
param([Parameter(Mandatory=$true)][string]$ExpectedConfigSha256,[Parameter(Mandatory=$true)][string]$ExpectedPreviousSha256)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Owner administrator approval required'}
if($root -ne 'D:\!nas' -or $ExpectedConfigSha256 -notmatch '^[a-f0-9]{64}$' -or $ExpectedPreviousSha256 -notmatch '^[a-f0-9]{64}$'){throw 'Invalid activation input'}
$config=Join-Path $root 'deploy\Caddyfile'
$previous=Join-Path $root '.runtime\research\apex-caddy-before.txt'
$caddy=Join-Path $root '.runtime\caddy\caddy.exe'
if((Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedConfigSha256 -or (Get-FileHash -LiteralPath $previous -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedPreviousSha256){throw 'Caddy source changed since review'}
$https=Get-CimInstance Win32_Service -Filter "Name='WydrianHttps'"
if($https.State -ne 'Running' -or $https.PathName -notlike '*D:\!nas\.runtime\services\WydrianHttps.exe*'){throw 'Unexpected HTTPS service'}
$iis=Get-CimInstance Win32_Service -Filter "Name='W3SVC'"
if($iis.State -ne 'Running' -or $iis.StartMode -ne 'Auto'){throw 'Unexpected IIS state; re-inspect before handover'}
[xml]$iisConfig=Get-Content -LiteralPath "$env:windir\System32\inetsrv\config\applicationHost.config" -Raw
$sites=@($iisConfig.configuration.'system.applicationHost'.sites.site)
$bindings=@($sites | ForEach-Object { $_.bindings.binding })
if($sites.Count -ne 1 -or $sites[0].name -ne 'Default Web Site' -or $bindings.Count -ne 1 -or $bindings[0].protocol -ne 'http' -or $bindings[0].bindingInformation -ne '*:80:'){throw 'Unexpected IIS sites/bindings; refusing broad stop'}
$backup=Join-Path $root ('.runtime\apex-activation\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $backup /inheritance:r /grant:r "${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot protect activation backup'}
Copy-Item -LiteralPath $previous -Destination (Join-Path $backup 'previous.Caddyfile')
Copy-Item -LiteralPath "$env:windir\System32\inetsrv\config\applicationHost.config" -Destination (Join-Path $backup 'applicationHost.config')
Copy-Item -LiteralPath '.env.local' -Destination (Join-Path $backup 'environment.snapshot')
@{iisStartMode=$iis.StartMode;iisState=$iis.State;httpsIdentity=$https.StartName;configSha256=$ExpectedConfigSha256} | ConvertTo-Json | Set-Content (Join-Path $backup 'before.json')
& $caddy validate --config $config --adapter caddyfile *> (Join-Path $backup 'validation.private.log')
if($LASTEXITCODE -ne 0){throw 'Caddy validation failed; IIS untouched'}
$createdFirewall=$false;$iisChanged=$false;$httpsChanged=$false
try {
  if((Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedConfigSha256){throw 'Configuration changed before activation'}
  $rule=Get-NetFirewallRule -Name 'WydrianAcmeHttp80' -ErrorAction SilentlyContinue
  if($rule){
    $port=$rule | Get-NetFirewallPortFilter;$app=$rule | Get-NetFirewallApplicationFilter
    if($rule.Enabled -ne 'True' -or $rule.Action -ne 'Allow' -or $rule.Direction -ne 'Inbound' -or $port.LocalPort -ne '80' -or $port.Protocol -ne 'TCP' -or $app.Program -ne $caddy){throw 'Existing ACME firewall rule differs; refusing overwrite'}
  } else {New-NetFirewallRule -Name 'WydrianAcmeHttp80' -DisplayName 'Wydrian Caddy ACME HTTP 80' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Program $caddy | Out-Null;$createdFirewall=$true}
  $iisChanged=$true
  Set-Service -Name W3SVC -StartupType Manual
  Stop-Service -Name W3SVC
  (Get-Service W3SVC).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
  if(@(Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue).Count){throw 'Port 80 remains owned by another listener; never stop HTTP.sys'}
  $httpsChanged=$true
  Restart-Service -Name WydrianHttps
  (Get-Service WydrianHttps).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
  $verified=$false
  for($attempt=0;$attempt -lt 90;$attempt++){
    try{$response=Invoke-WebRequest 'https://wydrian.hu/' -UseBasicParsing -TimeoutSec 10;if($response.StatusCode -eq 200 -and $response.Content -match 'Google'){$verified=$true;break}}catch{}
    Start-Sleep -Seconds 2
  }
  if(-not $verified){throw 'Apex TLS/application health gate failed'}
  if((Get-CimInstance Win32_Service -Filter "Name='WydrianHttps'").StartName -ne $https.StartName){throw 'HTTPS service identity changed'}
  @{passed=$true;iisStopped=$true;iisStartup='Manual';wasUntouched=$true;onlyHttpsRestarted=$true;httpsIdentityUnchanged=$true;firewallCreated=$createdFirewall;backup=$backup;at=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content '.runtime/research/apex-https-activation-result.json'
} catch {
  $rollbackErrors=@()
  if($httpsChanged){try{Stop-Service WydrianHttps;[IO.File]::WriteAllBytes($config,[IO.File]::ReadAllBytes((Join-Path $backup 'previous.Caddyfile')));Start-Service WydrianHttps}catch{$rollbackErrors+='https'}}
  if($createdFirewall){try{Remove-NetFirewallRule -Name 'WydrianAcmeHttp80'}catch{$rollbackErrors+='firewall'}}
  if($iisChanged){try{Set-Service W3SVC -StartupType Automatic;Start-Service W3SVC}catch{$rollbackErrors+='iis'}}
  @{passed=$false;rollbackErrors=$rollbackErrors;backup=$backup;error='Scoped HTTPS activation failed; no database restored or websites deleted'} | ConvertTo-Json | Set-Content '.runtime/research/apex-https-activation-result.json'
  throw 'Scoped HTTPS activation failed; inspect the private result before any retry'
}
