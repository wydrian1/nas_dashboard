param([string]$ProjectPath=(Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
# Read-only preflight. Git/atomic editor writes can recreate files and lose explicit service ACEs.
# Never broaden ACLs here: fail before the broker stops any running component.
$identity=[Security.Principal.NTAccount]::new('NT SERVICE\WydrianDashboard').Translate([Security.Principal.SecurityIdentifier])
$required=[Security.AccessControl.FileSystemRights]::ReadAndExecute
$deniedIdentities=@($identity.Value,'S-1-1-0','S-1-5-11','S-1-5-6','S-1-2-0')
# Next loads this shared policy from source at startup, even for a sealed build.
$paths=@('next.config.ts','lib\opencode-preview-policy.ts','tsconfig.json','next-env.d.ts','package.json','.env.local','.runtime\services\WydrianDashboard.xml','.runtime\services\WydrianDashboard.exe')
foreach($relative in $paths){
  $path=Join-Path $ProjectPath $relative
  $item=Get-Item -LiteralPath $path -Force
  if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw "Invalid dashboard runtime prerequisite: $relative"}
  $rules=(Get-Acl -LiteralPath $path).Access
  $allowed=0L
  foreach($rule in $rules){
    $sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    if($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly){continue}
    if($rule.AccessControlType -eq 'Deny' -and $sid -in $deniedIdentities -and ([long]$rule.FileSystemRights -band [long]$required)){throw "Dashboard runtime access denied: $relative"}
    if($rule.AccessControlType -eq 'Allow' -and $sid -eq $identity.Value){$allowed=$allowed -bor [long]$rule.FileSystemRights}
  }
  if(($allowed -band [long]$required) -ne [long]$required){throw "Missing explicit dashboard read/execute access: $relative. Restore its approved file-specific read ACE before deployment."}
}
@{passed=$true;dashboardReadPrerequisites=$paths.Count;readOnly=$true} | ConvertTo-Json -Compress
