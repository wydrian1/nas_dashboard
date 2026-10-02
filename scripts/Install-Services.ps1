# Run once in an elevated PowerShell, after the local test servers have been stopped.
# Creates ONLY WydrianDashboard / WydrianHttps; does not modify IIS or other services.
param([switch]$StopTrialProcesses)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Rendszergazdai PowerShell szükséges.' }
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
foreach ($name in @('WydrianDashboard', 'WydrianHttps')) {
    if (Get-Service $name -ErrorAction SilentlyContinue) { throw "$name már létezik; nem módosítom." }
}
foreach ($port in @(3000,443)) {
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    foreach ($listener in $listeners) {
        if (-not $StopTrialProcesses) { throw "A $port port még foglalt. Előbb állítsd le a próbaüzemi folyamatot." }
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        $expected = if ($port -eq 443) { Join-Path $root '.runtime\caddy\caddy.exe' } else { (Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1).FullName + '\node.exe' }
        if ($process.ExecutablePath -ne $expected -or $process.CommandLine -notlike "*$root*") { throw "A $port portot nem a projekt próbaüzemi folyamata használja; nem állítom le." }
        Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
    }
}
$node = Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
if (-not $node -or -not (Test-Path '.next\BUILD_ID') -or -not (Test-Path '.runtime\caddy\caddy.exe')) { throw 'A build vagy a futtatókörnyezet hiányzik.' }
$envFile = Join-Path $root '.env.local'
$content = [IO.File]::ReadAllText($envFile)
$content = [regex]::Replace($content, '(?m)^AUTH_URL=.*$', 'AUTH_URL=https://nas.wydrian.hu')
[IO.File]::WriteAllText($envFile, $content, (New-Object Text.UTF8Encoding $false))
$serviceDir = Join-Path $root '.runtime\services'
New-Item -ItemType Directory -Path $serviceDir -Force | Out-Null
foreach ($folder in @('data', 'data\caddy', 'logs', '.next\cache')) { New-Item -ItemType Directory -Path (Join-Path $root $folder) -Force | Out-Null }
$wrapper = Join-Path $serviceDir 'winsw.exe'
# Pinned official WinSW release. HTTPS download; do not use third-party mirrors.
Invoke-WebRequest 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' -UseBasicParsing -OutFile $wrapper
function Escape([string]$text) { return [Security.SecurityElement]::Escape($text) }
$services = @(
    @{ Id = 'WydrianDashboard'; Executable = Join-Path $node.FullName 'node.exe'; Arguments = '"' + (Join-Path $root 'node_modules\next\dist\bin\next') + '" start --hostname 127.0.0.1 --port 3000' },
    @{ Id = 'WydrianHttps'; Executable = Join-Path $root '.runtime\caddy\caddy.exe'; Arguments = 'run --config "' + (Join-Path $root 'deploy\Caddyfile') + '" --adapter caddyfile' }
)
foreach ($service in $services) {
    $target = Join-Path $serviceDir $service.Id
    Copy-Item -LiteralPath $wrapper -Destination "$target.exe"
    $xml = @"
<service>
  <id>$($service.Id)</id>
  <name>$($service.Id)</name>
  <description>Wydrian személyes dashboard</description>
  <executable>$(Escape $service.Executable)</executable>
  <arguments>$(Escape $service.Arguments)</arguments>
  <workingdirectory>$(Escape $root)</workingdirectory>
  <env name="NODE_ENV" value="production" />
  <env name="NEXT_TELEMETRY_DISABLED" value="1" />
  <serviceaccount><username>NT AUTHORITY\LocalService</username></serviceaccount>
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  <onfailure action="restart" delay="10 sec" />
  <stoptimeout>20 sec</stoptimeout>
  <logpath>$(Escape (Join-Path $root 'logs'))</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>3</keepFiles></log>
</service>
"@
    [IO.File]::WriteAllText("$target.xml", $xml, (New-Object Text.UTF8Encoding $false))
}
# Low-privilege service account: code is read-only, only data/log/cache are writable.
& icacls.exe $root /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Projekt olvasási jogosultság nem állítható be.' }
& icacls.exe $envFile /grant '*S-1-5-19:R' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'OAuth-fájl olvasási jogosultság nem állítható be.' }
foreach ($folder in @('data', 'logs', '.next\cache')) {
    & icacls.exe (Join-Path $root $folder) /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Adatmappa jogosultság nem állítható be.' }
}
if (-not (Get-NetFirewallRule -Name 'WydrianHttps443' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'WydrianHttps443' -DisplayName 'Wydrian HTTPS 443' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Program (Join-Path $root '.runtime\caddy\caddy.exe') | Out-Null
}
foreach ($service in $services) {
    & (Join-Path $serviceDir "$($service.Id).exe") install
    if ($LASTEXITCODE -ne 0) { throw "A $($service.Id) szolgáltatás telepítése sikertelen." }
}
Start-Service WydrianDashboard
Start-Service WydrianHttps
Get-Service WydrianDashboard,WydrianHttps | Select-Object Name,Status
Write-Output 'Kész: https://nas.wydrian.hu — a TLS kiadása néhány percet igényelhet. Naplók: logs'
