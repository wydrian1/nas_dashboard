import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir,link,symlink,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {archiveName,command} from '../lib/backup.ts';
import {backupEvidencePath,writeBackupEvidence,repairBackupEvidenceReadAccess,BACKUP_EVIDENCE_READER_SID,type BackupEvidenceTarget} from '../lib/backup-evidence.ts';
const archive=archiveName('a123456789ab',new Date('2026-10-12T01:00:00.000Z'));
const targets:BackupEvidenceTarget[]=[{kind:'status'},{kind:'receipt',archive},{kind:'restore'}];
const noop=async()=>{};
async function fixture(){const root=await mkdtemp(join(process.platform==='win32'?join(tmpdir(),'opencode'):tmpdir(),'backup-evidence-'));for(const folder of ['automatic-backups','research','backup-secrets'])await mkdir(join(root,'.runtime',folder),{recursive:true});return root;}
test('backup evidence targets admit only fixed metadata files and canonical archive receipts, never keys, archives or path traversal',()=>{
  for(const target of targets)assert.ok(backupEvidencePath('/fixture',target).endsWith('.json'));
  for(const name of ['../'+archive,archive+'.receipt.json',archive.replace('20261012','20260230'),archive.replace('a123456789ab','not-an-id'),'recovery-key.json','status.json',archive+'\\..\\private.key'])assert.throws(()=>backupEvidencePath('/fixture',{kind:'receipt',archive:name}));
  assert.throws(()=>backupEvidencePath('/fixture',{kind:'private'} as unknown as BackupEvidenceTarget));
});
test('every evidence replacement grants only the new metadata file before atomic publication, preserving archives and keys',async()=>{
  const root=await fixture();try{
    const key=join(root,'.runtime/backup-secrets/recovery-key.json'),encrypted=join(root,'.runtime/automatic-backups',archive);await writeFile(key,'synthetic key');await writeFile(encrypted,'synthetic archive');
    for(const target of targets){
      const path=backupEvidencePath(root,target);await writeFile(path,JSON.stringify({generation:0}));
      for(const generation of [1,2,3]){let grants=0;await writeBackupEvidence(root,target,{generation},async temporary=>{
        grants++;assert.equal(dirname(temporary),dirname(path));assert.ok(temporary.startsWith(path+'.')&&temporary.endsWith('.new'));
        assert.equal(JSON.parse(await readFile(path,'utf8')).generation,generation-1);assert.equal(JSON.parse(await readFile(temporary,'utf8')).generation,generation);
        assert.equal((await lstat(temporary)).nlink,1);
      });assert.equal(grants,1);assert.equal(JSON.parse(await readFile(path,'utf8')).generation,generation);}
      assert.ok((await readdir(dirname(path))).every(name=>!name.endsWith('.new')));
    }
    assert.equal(await readFile(key,'utf8'),'synthetic key');assert.equal(await readFile(encrypted,'utf8'),'synthetic archive');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('ACL publication failures and oversized metadata leave previous evidence intact and clean up only their own temporary',async()=>{
  const root=await fixture();try{
    const target=targets[0],path=backupEvidencePath(root,target);await writeFile(path,'{"state":"old"}');await writeFile(path+'.other-run.new','keep');
    await assert.rejects(writeBackupEvidence(root,target,{state:'success'},async()=>{throw new Error('Synthetic ACL failure');}));
    assert.equal(await readFile(path,'utf8'),'{"state":"old"}');
    await assert.rejects(writeBackupEvidence(root,target,{padding:'á'.repeat(128*1024)},noop));
    assert.equal(await readFile(path,'utf8'),'{"state":"old"}');assert.deepEqual((await readdir(dirname(path))).filter(name=>name.endsWith('.new')),['status.json.other-run.new']);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('evidence writers and repair refuse symlinks, directory targets, hardlinked evidence and linked parent directories',async()=>{
  const root=await fixture();try{
    const target=targets[0],path=backupEvidencePath(root,target),privateFile=join(root,'.runtime/backup-secrets/recovery-key.json');await writeFile(privateFile,'keep');
    await link(privateFile,path);await assert.rejects(writeBackupEvidence(root,target,{state:'success'},noop));await assert.rejects(repairBackupEvidenceReadAccess(root,target));await rm(path);
    await symlink(privateFile,path,'file');await assert.rejects(writeBackupEvidence(root,target,{state:'success'},noop));await assert.rejects(repairBackupEvidenceReadAccess(root,target));await rm(path);
    await mkdir(path);await assert.rejects(writeBackupEvidence(root,target,{},noop));await rm(path,{recursive:true});
    const parent=dirname(path);await rm(parent,{recursive:true});await symlink(join(root,'.runtime/backup-secrets'),parent,process.platform==='win32'?'junction':'dir');
    await assert.rejects(writeBackupEvidence(root,target,{},noop));assert.equal(await readFile(privateFile,'utf8'),'keep');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('both backup producers use the ACL-aware writer for status, local/cloud receipts and restore proof',()=>{
  const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),backup=read('scripts/Run-Backup.ts'),restore=read('scripts/Test-CloudBackup.ts');
  assert.match(backup,/writeBackupEvidence\(root,\{kind:'status'\}/);assert.match(backup,/kind:'receipt',archive:name/);assert.match(backup,/kind:'receipt',archive:item/);assert.doesNotMatch(backup,/await writeFile\(/);
  assert.match(restore,/writeBackupEvidence\(root,\{kind:'restore'\}/);assert.doesNotMatch(restore,/writeFile\(/);
  const repair=read('scripts/Repair-BackupEvidenceAccess.ts');assert.doesNotMatch(repair,/writeFile|Run-Backup|readFile\([^)]*(?:key|nasbackup)/);
});
if(process.platform==='win32')test('real Windows ACLs survive repeated metadata replacements with a dedicated service read ACE and no inherited directory read grant',async()=>{
  const root=await fixture();try{
    const powershell=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    for(const target of targets){for(let generation=1;generation<=2;generation++){
      await writeBackupEvidence(root,target,{generation});
      const path=backupEvidencePath(root,target).replaceAll("'","''"),folder=dirname(backupEvidencePath(root,target)).replaceAll("'","''");
      const script=`$ErrorActionPreference='Stop';$sid='${BACKUP_EVIDENCE_READER_SID}';$actual=([Security.Principal.NTAccount]::new('NT SERVICE\\WydrianDashboard')).Translate([Security.Principal.SecurityIdentifier]).Value;if($actual -ne $sid){throw 'Service SID mismatch'};$file=@((Get-Acl -LiteralPath '${path}').Access|Where-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $sid});$folder=@((Get-Acl -LiteralPath '${folder}').Access|Where-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $sid});@{file=@($file|ForEach-Object{@{rights=[long]$_.FileSystemRights;inherit=[int]$_.InheritanceFlags;inherited=$_.IsInherited;allow=$_.AccessControlType -eq 'Allow'}});folder=@($folder|ForEach-Object{@{rights=[long]$_.FileSystemRights;inherit=[int]$_.InheritanceFlags;allow=$_.AccessControlType -eq 'Allow'}})}|ConvertTo-Json -Depth 5 -Compress`;
      const acl=JSON.parse(await command(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],15000));
      assert.equal(acl.file.length,1);assert.ok(acl.file[0].allow&&!acl.file[0].inherited);assert.equal(acl.file[0].inherit,0);assert.equal(acl.file[0].rights&0x1f01ff,0x120089); // Read/synchronize, no write/execute/delete/ACL-change.
      assert.equal(acl.folder.length,1);assert.ok(acl.folder[0].allow);assert.equal(acl.folder[0].rights&0x1f01ff,0x20);assert.equal(acl.folder[0].inherit,0);
    }}
  }finally{await rm(root,{recursive:true,force:true});}
});
