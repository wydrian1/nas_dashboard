import {readFile,lstat} from 'node:fs/promises';
import {backupEvidencePath,repairBackupEvidenceReadAccess,type BackupEvidenceTarget} from '../lib/backup-evidence.ts';

// Explicit operator action only. Does not rewrite evidence, start a backup or read a key/archive.
const root=process.cwd();
try{
  const statusTarget:BackupEvidenceTarget={kind:'status'},statusPath=backupEvidencePath(root,statusTarget),stat=await lstat(statusPath);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>128*1024)throw new Error('Unsafe evidence');
  const status=JSON.parse(await readFile(statusPath,'utf8')) as {archive?:unknown};
  const targets:BackupEvidenceTarget[]=[statusTarget];
  if(typeof status.archive==='string'){const receipt:BackupEvidenceTarget={kind:'receipt',archive:status.archive};backupEvidencePath(root,receipt);targets.push(receipt);}
  const restore:BackupEvidenceTarget={kind:'restore'};
  try{await lstat(backupEvidencePath(root,restore));targets.push(restore);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  // Validate all selected files before changing the first ACL.
  for(const target of targets){const info=await lstat(backupEvidencePath(root,target));if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>128*1024)throw new Error('Unsafe evidence');}
  for(const target of targets)await repairBackupEvidenceReadAccess(root,target);
  console.log(JSON.stringify({repaired:true,evidenceFiles:targets.length,fileScopedReadOnly:true,noArchiveOrKeyGrant:true,noContentChanges:true}));
}catch{console.error('Backup evidence access repair failed; no private content is logged.');process.exitCode=1;}
