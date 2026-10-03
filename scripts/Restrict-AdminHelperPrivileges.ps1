# Local UAC-only maintenance for the helper itself; never exposed as a web operation.
$ErrorActionPreference='Stop'
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Local administrator approval is required.'}
$name='WydrianAdminHelper'
$root=Join-Path $env:ProgramFiles 'Wydrian NAS Admin Helper'
$service=Get-CimInstance Win32_Service -Filter "Name='$name'"
if(-not $service -or $service.StartName -ne "NT SERVICE\$name" -or $service.PathName -ne ('"'+(Join-Path $root 'WydrianAdminHelper.exe')+'"')){throw 'Unexpected helper identity/path; refusing maintenance.'}
$jobs=@(ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path $root 'data\state.json'))))
if($jobs | Where-Object {$_.state -in @('queued','running')}){throw 'A confirmed helper operation is active; wait for its result before maintenance.'}
$sc=Join-Path $env:WINDIR 'System32\sc.exe'
& $sc privs $name SeChangeNotifyPrivilege
if($LASTEXITCODE -ne 0){throw 'Could not set the exact helper privileges.'}
Restart-Service $name
& $sc qprivs $name
Get-Service $name | Select-Object Name,Status
