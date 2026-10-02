# Run elevated. Creates/updates ONLY WydrianPokemon; uses immutable code snapshots.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is required.' }
Start-Transcript -Path (Join-Path $root 'logs\pokemon-installation.log') -Append | Out-Null
$node = Get-ChildItem (Join-Path $root '.runtime') -Directory -Filter 'node-v24*-win-x64' | Select-Object -First 1
$serviceDir = Join-Path $root '.runtime\services'
$target = Join-Path $serviceDir 'WydrianPokemon'
if (-not $node -or -not (Test-Path (Join-Path $serviceDir 'winsw.exe'))) { throw 'Local Node/WinSW runtime is missing.' }
$existing = Get-Service WydrianPokemon -ErrorAction SilentlyContinue
if ($existing) {
    $registered = Get-CimInstance Win32_Service -Filter "Name='WydrianPokemon'"
    if ($registered.PathName.Trim('"') -ne "$target.exe") { throw 'Service belongs to another project; refusing to change it.' }
}
$release = Join-Path $root ('.runtime\pokemon\release-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path $release) { throw 'Release folder already exists.' }
New-Item -ItemType Directory -Path "$release\lib","$release\scripts" -Force | Out-Null
Copy-Item -Recurse -LiteralPath 'lib\pokemon' -Destination "$release\lib\pokemon"
Copy-Item -Recurse -LiteralPath 'lib\mobile' -Destination "$release\lib\mobile"
Copy-Item -Recurse -LiteralPath 'lib\finance' -Destination "$release\lib\finance"
foreach ($file in @('db-schema.ts','users.ts','url-policy.ts','feed-download.ts','sql-rows.ts')) { Copy-Item -LiteralPath "lib\$file" -Destination "$release\lib\$file" }
Copy-Item -LiteralPath 'scripts\Pokemon-Worker.ts' -Destination "$release\scripts\Pokemon-Worker.ts"
& (Join-Path $node.FullName 'node.exe') 'scripts\Backup-Database.mjs'
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
$oldXml = if (Test-Path "$target.xml") { [IO.File]::ReadAllText("$target.xml") } else { $null }
if ($existing) { Stop-Service WydrianPokemon }
if (-not (Test-Path "$target.exe")) { Copy-Item -LiteralPath (Join-Path $serviceDir 'winsw.exe') -Destination "$target.exe" }
function Escape([string]$text) { return [Security.SecurityElement]::Escape($text) }
$arguments = '--env-file="' + (Join-Path $root '.env.local') + '" --experimental-strip-types "' + (Join-Path $release 'scripts\Pokemon-Worker.ts') + '"'
$xml = @"
<service>
  <id>WydrianPokemon</id><name>WydrianPokemon</name>
  <description>Wydrian Pokemon TCG availability monitor</description>
  <executable>$(Escape (Join-Path $node.FullName 'node.exe'))</executable>
  <arguments>$(Escape $arguments)</arguments>
  <workingdirectory>$(Escape $root)</workingdirectory>
  <env name="NODE_ENV" value="production" />
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user><password></password></serviceaccount>
  <startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart>
  <onfailure action="restart" delay="30 sec" /><stoptimeout>30 sec</stoptimeout>
  <logpath>$(Escape (Join-Path $root 'logs'))</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>3</keepFiles></log>
</service>
"@
try {
    [IO.File]::WriteAllText("$target.xml", $xml, (New-Object Text.UTF8Encoding $false))
    & icacls.exe $release /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Worker read permissions could not be granted.' }
    # Node realpath() stats ancestor folders. Grant only attributes/traverse on
    # those directories, not directory listing or inherited file access.
    $ancestor = Split-Path $root -Parent
    while ($ancestor -and (Split-Path $ancestor -Parent)) {
        & icacls.exe $ancestor /grant '*S-1-5-19:(RA,X,RC,S)' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Cannot grant ancestor directory attributes/traverse permissions.' }
        $ancestor = Split-Path $ancestor -Parent
    }
    if (-not $existing) { & "$target.exe" install; if ($LASTEXITCODE -ne 0) { throw 'Worker installation failed.' } }
    & sc.exe config WydrianPokemon obj= 'NT AUTHORITY\LocalService'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot configure the low-privilege service account.' }
    $configured = Get-CimInstance Win32_Service -Filter "Name='WydrianPokemon'"
    if ($configured.StartName -ne 'NT AUTHORITY\LocalService') { throw 'Worker service account is not LocalService.' }
    Start-Service WydrianPokemon
    Get-Service WydrianPokemon | Select-Object Name,Status
} catch {
    if ($existing -and $oldXml) { [IO.File]::WriteAllText("$target.xml", $oldXml, (New-Object Text.UTF8Encoding $false)); Start-Service WydrianPokemon }
    throw
}
Stop-Transcript | Out-Null
