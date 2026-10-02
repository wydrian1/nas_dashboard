import { randomBytes } from 'node:crypto';
import { existsSync,writeFileSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupSettings } from '../lib/backup.ts';
const root=process.cwd(),secrets=join(root,'.runtime/backup-secrets'),settingsPath=join(secrets,'settings.json'),keyPath=join(secrets,'recovery-key.json');
if(!existsSync(settingsPath)){const settings:BackupSettings={version:1,installationId:randomBytes(6).toString('hex'),retentionDays:30,cloudEnabled:false,remote:'nas-drive',remoteDirectory:'Wydrian-NAS-Backup'};writeFileSync(settingsPath,JSON.stringify(settings,null,2),{flag:'wx'});}
if(!existsSync(keyPath))writeFileSync(keyPath,JSON.stringify({version:1,algorithm:'AES-256-GCM',key:randomBytes(32).toString('base64')},null,2),{flag:'wx'});
writeFileSync(join(secrets,'RECOVERY-README.txt'),'Keep recovery-key.json on an independent offline device or in a password manager. Do not share it or upload it unencrypted. Without this key encrypted backups cannot be restored. The key does not depend on this Windows installation. The rclone OAuth configuration can be recreated using Google sign-in.\r\n');
const settings=JSON.parse(readFileSync(settingsPath,'utf8'));console.log(JSON.stringify({configured:true,cloudEnabled:settings.cloudEnabled,retentionDays:settings.retentionDays,recoveryKeyPath:keyPath,keyNotPrinted:true}));
