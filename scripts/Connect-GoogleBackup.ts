import { readFile,writeFile,access } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { command,verifyGoogleBackupConfig } from '../lib/backup.ts';

const root=process.cwd(),directory=join(root,'.runtime/backup-secrets'),clientPath=join(directory,'google-oauth-client.json'),config=join(directory,'rclone.conf'),rclone=join(root,'.runtime/rclone/rclone.exe');
const json=JSON.parse(await readFile(clientPath,'utf8')),client=json.installed;
if(!client || typeof client.client_id!=='string' || !/^[A-Za-z0-9.-]+\.apps\.googleusercontent\.com$/.test(client.client_id) || typeof client.client_secret!=='string' || !/^[A-Za-z0-9_-]+$/.test(client.client_secret))throw new Error('A dedicated Google Desktop app OAuth JSON is required. Do not reuse the dashboard web client.');
try{await access(config);verifyGoogleBackupConfig(await readFile(config,'utf8'),client.client_id,'nas-drive',false);console.log('Existing dedicated rclone configuration preserved.');}
catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await writeFile(config,`[nas-drive]\ntype = drive\nclient_id = ${client.client_id}\nclient_secret = ${client.client_secret}\nscope = drive.file\n`,{flag:'wx'});}
await new Promise<void>((resolve,reject)=>{
  // create deletes existing sections, including client and scope. update preserves them.
  const child=spawn(rclone,['config','update','nas-drive','config_is_local','true','config_change_team_drive','false','config_auth_no_browser','true','--no-output','--config',config],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let shown=false;
  const progress=(chunk:Buffer)=>{const url=String(chunk).match(/http:\/\/127\.0\.0\.1:53682\/auth\S*/)?.[0];if(url && !shown){shown=true;console.log('Google authorization: '+url);console.log('Approve only the Wydrian NAS Backup access in your browser. OAuth tokens are never printed.');}};
  child.stdout.on('data',progress);child.stderr.on('data',progress);
  const timer=setTimeout(()=>{child.kill();reject(new Error('Google authorization timed out; no backup was uploaded.'));},20*60_000);
  child.once('error',()=>{clearTimeout(timer);reject(new Error('rclone authorization could not start'));});child.once('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Google authorization failed'));else resolve();});
});
verifyGoogleBackupConfig(await readFile(config,'utf8'),client.client_id);
await command(rclone,['mkdir','nas-drive:Wydrian-NAS-Backup','--config',config]);
const settingsPath=join(directory,'settings.json'),settings=JSON.parse(await readFile(settingsPath,'utf8'));settings.cloudEnabled=true;await writeFile(settingsPath,JSON.stringify(settings,null,2));
console.log('Google Drive backup connection enabled. Encrypted uploads go only to Wydrian-NAS-Backup.');
