$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$destination=Join-Path $root '.runtime\deployer-build'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$source=Join-Path $root 'deployment\NasDeployer.cs'
foreach($test in @($true,$false)){
  $file=if($test){'DeployerTests.exe'}else{'WydrianDeployer.exe'}
  $args=@('/nologo','/noconfig','/target:exe','/platform:x64','/optimize+','/checked+','/codepage:65001','/r:System.dll','/r:System.Core.dll','/r:System.Xml.dll','/r:System.ServiceProcess.dll','/r:System.Web.Extensions.dll',"/out:$(Join-Path $destination $file)")
  if($test){$args+='/define:DEPLOYER_TESTS'}
  & $compiler $args $source
  if($LASTEXITCODE -ne 0){throw 'Deployer compilation failed.'}
  if($test){& (Join-Path $destination $file) --self-test;if($LASTEXITCODE -ne 0){throw 'Deployer native tests failed.'}}
}
Get-FileHash (Join-Path $destination 'WydrianDeployer.exe') -Algorithm SHA256 | Select-Object Path,Hash
