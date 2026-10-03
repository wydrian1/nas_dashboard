$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path -LiteralPath $compiler)){throw '.NET Framework C# compiler was not found.'}
$destination=Join-Path $root '.runtime\admin-helper-build'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$testExe=Join-Path $destination 'AdminHelperTests.exe'
& $compiler /nologo /noconfig /target:exe /platform:x64 /optimize+ /checked+ /codepage:65001 /define:HELPER_TESTS /r:System.dll /r:System.Core.dll /r:System.ServiceProcess.dll /r:System.Web.Extensions.dll "/out:$testExe" (Join-Path $root 'admin-helper\NasAdminHelper.cs')
if($LASTEXITCODE -ne 0){throw 'Admin-helper compilation failed.'}
& $testExe --self-test
if($LASTEXITCODE -ne 0){throw 'Admin-helper self-tests failed.'}
# Compile production without the self-test conditional; no Windows service is installed/started here.
& $compiler /nologo /noconfig /target:exe /platform:x64 /optimize+ /checked+ /codepage:65001 /r:System.dll /r:System.Core.dll /r:System.ServiceProcess.dll /r:System.Web.Extensions.dll "/out:$(Join-Path $destination 'WydrianAdminHelper.exe')" (Join-Path $root 'admin-helper\NasAdminHelper.cs')
if($LASTEXITCODE -ne 0){throw 'Admin-helper production compilation failed.'}
Get-FileHash (Join-Path $destination 'WydrianAdminHelper.exe') -Algorithm SHA256 | Select-Object Path,Hash
