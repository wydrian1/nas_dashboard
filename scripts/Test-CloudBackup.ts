import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { command,fileHash,ownedArchiveDate,verifyGoogleBackupConfig } from '../lib/backup.ts';
import {writeBackupEvidence} from '../lib/backup-evidence.ts';
const root=process.cwd(),output=join(root,'.runtime/automatic-backups'),secrets=join(root,'.runtime/backup-secrets');
let work:string|undefined;
try{
  const settings=JSON.parse(await readFile(join(secrets,'settings.json'),'utf8')),status=JSON.parse(await readFile(join(output,'status.json'),'utf8'));
  if(!settings.cloudEnabled || status.state!=='success' || !status.cloudVerified || ownedArchiveDate(status.archive,settings.installationId)===null)throw new Error('A verified cloud backup is required');
  const receipt=JSON.parse(await readFile(join(output,status.archive+'.receipt.json'),'utf8'));
  if(!receipt.cloudVerifiedAt || !receipt.restoreVerifiedAt)throw new Error('Verified backup receipt required');
  const config=join(secrets,'rclone.conf'),client=JSON.parse(await readFile(join(secrets,'google-oauth-client.json'),'utf8')).installed;verifyGoogleBackupConfig(await readFile(config,'utf8'),client.client_id,settings.remote);
  work=await mkdtemp(join(output,'cloud-restore-test-'));const downloaded=join(work,'downloaded.nasbackup');
  await command(join(root,'.runtime/rclone/rclone.exe'),['copyto',settings.remote+':'+settings.remoteDirectory+'/'+status.archive,downloaded,'--immutable','--config',config,'--retries','3']);
  if(await fileHash(downloaded)!==receipt.sha256)throw new Error('Downloaded backup checksum mismatch');
  const kit=join(work,'recovery-kit'),zip=join(secrets,'backup-recovery-kit.zip');
  await command('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replaceAll("'","''")}' -DestinationPath '${kit.replaceAll("'","''")}'`]);
  const restored=JSON.parse(await command(process.execPath,[join(kit,'restore.mjs'),'--archive',downloaded,'--key',join(secrets,'recovery-key.json'),'--destination',join(work,'restored')])) as {filesVerified:number;sqliteIntegrityVerified:boolean;productionUntouched:boolean};
  if(!restored.sqliteIntegrityVerified || !restored.productionUntouched || restored.filesVerified<1)throw new Error('Restore verification incomplete');
  const report={verifiedAt:new Date().toISOString(),archive:status.archive,downloadedSha256Verified:true,authenticatedDecryptionVerified:true,standaloneRecoveryKitVerified:true,manifestFilesVerified:restored.filesVerified,sqliteIntegrityVerified:true,productionUntouched:true};
  await writeBackupEvidence(root,{kind:'restore'},report);console.log(JSON.stringify(report));
}catch{console.error('Cloud backup restore test failed; no provider response or credential is logged.');process.exitCode=1;}
finally{if(work)await rm(work,{recursive:true,force:true});}
