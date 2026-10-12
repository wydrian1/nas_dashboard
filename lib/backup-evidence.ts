import {lstat,open,rename,unlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {command,ownedArchiveDate} from './backup.ts';

// Stable Windows service SID for NT SERVICE\WydrianDashboard, not LocalService.
export const BACKUP_EVIDENCE_READER_SID='S-1-5-80-2982587521-2696464312-3757165661-4171709350-3728038416';
export type BackupEvidenceTarget={kind:'status'}|{kind:'receipt';archive:string}|{kind:'restore'};
const limit=128*1024;
export function backupEvidencePath(root:string,target:BackupEvidenceTarget):string {
  if(target.kind==='status')return join(resolve(root),'.runtime','automatic-backups','status.json');
  if(target.kind==='restore')return join(resolve(root),'.runtime','research','cloud-backup-restore-verified.json');
  if(target.kind==='receipt'){
    const id=/^nas-([a-f0-9]{12})-/.exec(target.archive)?.[1];
    if(id&&ownedArchiveDate(target.archive,id)!==null)return join(resolve(root),'.runtime','automatic-backups',target.archive+'.receipt.json');
  }
  throw new Error('Invalid backup evidence target');
}
async function safeParents(root:string,path:string){
  for(const directory of [resolve(root),join(resolve(root),'.runtime'),dirname(path)]){
    const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe backup evidence directory');
  }
}
async function safeFile(path:string,optional=false){
  try{const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>limit)throw new Error('Unsafe backup evidence file');}
  catch(error){if(optional&&(error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
}
async function grantRead(path:string){
  if(process.platform!=='win32')return;
  const executable=join(process.env.SystemRoot||'C:\\Windows','System32','icacls.exe');
  // This-folder-only traverse: no listing, read-data, inheritance or directory-wide RX.
  await command(executable,[dirname(path),'/grant',`*${BACKUP_EVIDENCE_READER_SID}:(X)`],15000);
  await command(executable,[path,'/grant',`*${BACKUP_EVIDENCE_READER_SID}:R`],15000);
}
export async function repairBackupEvidenceReadAccess(root:string,target:BackupEvidenceTarget){
  const path=backupEvidencePath(root,target);await safeParents(root,path);await safeFile(path);await grantRead(path);
}
export async function writeBackupEvidence(root:string,target:BackupEvidenceTarget,value:object,protect:(path:string)=>Promise<void>=grantRead){
  const path=backupEvidencePath(root,target),text=JSON.stringify(value,null,2);
  if(typeof text!=='string'||Buffer.byteLength(text)>limit)throw new Error('Backup evidence exceeds its size limit');
  await safeParents(root,path);await safeFile(path,true);
  const temporary=path+'.'+randomUUID()+'.new',handle=await open(temporary,'wx',0o600);
  try{
    try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}
    await safeFile(temporary);await protect(temporary); // ACL is part of publication, not a later repair.
    await safeParents(root,path);await safeFile(path,true);await rename(temporary,path);
  }finally{await unlink(temporary).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});}
}
