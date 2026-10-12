import { readFile,mkdir,mkdtemp,readdir,rm,open,unlink } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { archiveName,ownedArchiveDate,prepareStage,verifyStage,encryptArchive,decryptArchive,fileHash,command,verifyGoogleBackupConfig } from '../lib/backup.ts';
import type { BackupSettings } from '../lib/backup.ts';
import {writeBackupEvidence} from '../lib/backup-evidence.ts';

const root=process.cwd(),secrets=join(root,'.runtime/backup-secrets'),output=join(root,'.runtime/automatic-backups'),now=new Date();
let workspace:string|undefined,archive:string|undefined,cloudVerified=false,locked=false;
const lockPath=join(output,'running.lock');
async function status(value:object){await writeBackupEvidence(root,{kind:'status'},{updatedAt:new Date().toISOString(),...value});}
async function remoteHash(executable:string,args:string[]):Promise<string> {
  return new Promise((resolve,reject)=>{const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']}),hash=createHash('sha256');child.stdout.on('data',data=>hash.update(data));child.stderr.resume();
    const timer=setTimeout(()=>{child.kill();reject(new Error('Cloud verification timed out'));},30*60_000);child.once('error',()=>{clearTimeout(timer);reject(new Error('Cloud verification could not start'));});child.once('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Cloud verification failed'));else resolve(hash.digest('hex'));});});
}
try{
  await mkdir(output,{recursive:true});
  try{const lock=await open(lockPath,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:now.toISOString()}));await lock.close();locked=true;}
  catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST'){const existing=JSON.parse(await readFile(lockPath,'utf8'));let alive=false;try{process.kill(existing.pid,0);alive=true;}catch{}if(alive)throw new Error('Another backup is running');if(Date.now()-Date.parse(existing.startedAt)<2*60*60_000)throw new Error('Recent backup lock requires inspection');await unlink(lockPath);const lock=await open(lockPath,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:now.toISOString()}));await lock.close();locked=true;}else throw error;}
  const settings=JSON.parse(await readFile(join(secrets,'settings.json'),'utf8')) as BackupSettings;
  if(settings.version!==1 || !Number.isInteger(settings.retentionDays) || settings.retentionDays<1 || settings.retentionDays>365 || typeof settings.cloudEnabled!=='boolean' || !/^[a-z0-9-]{1,40}$/.test(settings.remote) || !/^[A-Za-z0-9_-]{1,80}$/.test(settings.remoteDirectory))throw new Error('Invalid backup settings');
  const key=JSON.parse(await readFile(join(secrets,'recovery-key.json'),'utf8')).key;
  workspace=await mkdtemp(join(output,'work-'));const stage=join(workspace,'snapshot');const manifest=await prepareStage(root,stage,now);await verifyStage(stage);
  const packed=join(workspace,'snapshot.tar.gz');await command('tar.exe',['-czf',packed,'-C',stage,'.']);
  const name=archiveName(settings.installationId,now);archive=join(output,name);await encryptArchive(packed,archive,key);const sha256=await fileHash(archive);
  // Full authenticated decryption/extraction and manifest/SQLite check before reporting local success.
  const restoredTar=join(workspace,'restore.tar.gz'),restored=join(workspace,'restored');await decryptArchive(archive,restoredTar,key);await mkdir(restored);await command('tar.exe',['-xzf',restoredTar,'-C',restored]);await verifyStage(restored);
  await writeBackupEvidence(root,{kind:'receipt',archive:name},{version:1,createdAt:now.toISOString(),archive:name,sha256,restoreVerifiedAt:new Date().toISOString(),cloudVerifiedAt:null});
  await status({state:settings.cloudEnabled ? 'uploading' : 'local-only',archive:name,localRestoreVerified:true,cloudVerified:false,fileCount:manifest.files.length});
  if(settings.cloudEnabled){
    const rclone=join(root,'.runtime/rclone/rclone.exe'),config=join(secrets,'rclone.conf'),remote=settings.remote+':'+settings.remoteDirectory,common=['--config',config,'--retries','3','--low-level-retries','5','--contimeout','30s','--timeout','5m'];
    const client=JSON.parse(await readFile(join(secrets,'google-oauth-client.json'),'utf8')).installed;
    if(!client?.client_id)throw new Error('Dedicated Desktop OAuth configuration missing');verifyGoogleBackupConfig(await readFile(config,'utf8'),client.client_id,settings.remote);
    const pending=(await readdir(output)).filter(name=>ownedArchiveDate(name,settings.installationId)!==null).sort();
    for(const item of pending){
      const path=join(output,item);let receipt;try{receipt=JSON.parse(await readFile(path+'.receipt.json','utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
      if(receipt.cloudVerifiedAt)continue;
      const expected=await fileHash(path);if(expected!==receipt.sha256)throw new Error('Local archive checksum mismatch');
      await command(rclone,['copyto',path,remote+'/'+item,'--immutable',...common]);
      if(await remoteHash(rclone,['cat',remote+'/'+item,...common])!==expected)throw new Error('Uploaded archive checksum mismatch');
      receipt.cloudVerifiedAt=new Date().toISOString();await writeBackupEvidence(root,{kind:'receipt',archive:item},receipt);
    }
    cloudVerified=true;
    const entries=JSON.parse(await command(rclone,['lsjson',remote,'--files-only',...common])) as {Name:string;IsDir:boolean}[],cutoff=now.getTime()-settings.retentionDays*86400000;
    // Only files bearing this installation's unique name prefix are eligible. Never sync/purge a Drive.
    for(const item of entries){const created=ownedArchiveDate(item.Name,settings.installationId);if(!item.IsDir && created!==null && created<cutoff)await command(rclone,['deletefile',remote+'/'+item.Name,...common]);}
  }
  const cutoff=now.getTime()-settings.retentionDays*86400000;
  for(const name of await readdir(output)){const created=ownedArchiveDate(name,settings.installationId);if(created===null || created>=cutoff)continue;const path=join(output,name);let receipt;try{receipt=JSON.parse(await readFile(path+'.receipt.json','utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}if(!receipt.restoreVerifiedAt || (settings.cloudEnabled && !receipt.cloudVerifiedAt))continue;await unlink(path);await unlink(path+'.receipt.json');}
  await status({state:cloudVerified ? 'success' : 'local-only',archive:archive && archive.slice(output.length+1),localRestoreVerified:true,cloudVerified,retentionDays:settings.retentionDays});
  console.log(cloudVerified ? 'Encrypted backup created, restore-tested and Google Drive upload verified.' : 'Encrypted local backup created and restore-tested. Google Drive connection is not enabled yet.');
}catch(error){
  if(locked)await status({state:'failed',localArchiveCreated:!!archive,cloudVerified,error:'Backup failed; inspect task/configuration and retry. No provider response or credential is logged.'}).catch(()=>{});
  console.error(error instanceof Error && /^(Another backup|Recent backup lock)/.test(error.message) ? error.message : 'Automatic backup failed; previous backups remain available.');process.exitCode=1;
}finally{
  if(workspace)await rm(workspace,{recursive:true,force:true}); // Only the temporary directory this run created.
  if(locked)await unlink(lockPath).catch(()=>{});
}
