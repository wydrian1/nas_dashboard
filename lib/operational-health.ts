import type {DatabaseSync} from 'node:sqlite';
import {readFileSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {requireAccess,ownerEmail,AccessError} from './users.ts';
import {SHOP_IDS} from './pokemon/types.ts';
import {shop} from './pokemon/store.ts';
import {shopHealth} from './pokemon/health.ts';
import {WEB_VERSION} from './mobile/release.ts';
export type BackupHealth={state:'ok'|'warning'|'unknown';localAt:string|null;cloudAt:string|null;restoreAt:string|null;message:string};
const timestamp=(value:unknown,now:number)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+60_000?new Date(value).toISOString():null;
export function backupHealth(status:unknown,receipt:unknown,restore:unknown,now:number):BackupHealth {
  const s=status as Record<string,unknown>|null,r=receipt as Record<string,unknown>|null,t=restore as Record<string,unknown>|null;
  const receiptMatches=typeof s?.archive==='string'&&r?.archive===s.archive&&typeof r?.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256);
  const localAt=receiptMatches&&s?.localRestoreVerified===true&&timestamp(r?.restoreVerifiedAt,now)?timestamp(r?.createdAt,now):null,cloudAt=localAt&&s?.cloudVerified===true?timestamp(r?.cloudVerifiedAt,now):null;
  const restoreAt=t?.sqliteIntegrityVerified===true&&t?.productionUntouched===true&&t?.authenticatedDecryptionVerified===true&&t?.standaloneRecoveryKitVerified===true&&t?.downloadedSha256Verified===true&&Number.isSafeInteger(t?.manifestFilesVerified)&&Number(t?.manifestFilesVerified)>0?timestamp(t?.verifiedAt,now):null;
  const fresh=(value:string|null,max:number)=>!!value&&now-Date.parse(value)<=max;
  const ok=s?.state==='success'&&fresh(localAt,36*60*60_000)&&fresh(cloudAt,36*60*60_000)&&fresh(restoreAt,30*86400000);
  return {state:ok?'ok':s?'warning':'unknown',localAt,cloudAt,restoreAt,message:ok?'Friss, helyreállítás-ellenőrzött helyi és felhőmentés.':!s?'Mentési bizonyíték nem elérhető; ezt nem tekintjük sikernek.':'A mentés vagy a felhőből végzett visszaállítási próba hiányzik, hibás vagy elavult.'};
}
function json(root:string,path:string):unknown {try{const file=join(root,path),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128*1024)return null;return JSON.parse(readFileSync(file,'utf8'));}catch{return null;}}
export function operationalHealth(db:DatabaseSync,email:string,root=process.cwd(),now=Date.now()){
  requireAccess(db,email,'admin');if(email.toLowerCase()!==ownerEmail())throw new AccessError('Ez az állapotnézet csak a tulajdonosnak érhető el.');
  const heartbeat=Number(db.prepare('SELECT heartbeat FROM pokemon_worker WHERE id=1').get()?.heartbeat)||null,workerAlive=heartbeat!==null&&heartbeat<=now+60_000&&now-heartbeat<4*60_000;
  const shops=SHOP_IDS.map(id=>{const current=shop(db,id);return {id,name:current.name,status:current.status,nextScan:current.next_scan,failures:current.failure_count,...shopHealth(current,workerAlive,now)};});
  const status=json(root,'.runtime/automatic-backups/status.json') as {archive?:unknown}|null;
  const archive=typeof status?.archive==='string'&&/^[a-zA-Z0-9_-]{1,180}\.nasbackup$/.test(status.archive)?status.archive:null;
  const backup=backupHealth(status,archive?json(root,'.runtime/automatic-backups/'+archive+'.receipt.json'):null,json(root,'.runtime/research/cloud-backup-restore-verified.json'),now);
  const release=db.prepare('SELECT commit_sha,version,created_at FROM release_announcements ORDER BY created_at DESC LIMIT 1').get() as {commit_sha:string;version:string;created_at:number}|undefined;
  const push=db.prepare("SELECT state,count(*) count FROM mobile_push_outbox WHERE created_at>=? GROUP BY state").all(now-86400000).map(row=>({state:String(row.state),count:Number(row.count)}));
  return {checkedAt:now,webVersion:WEB_VERSION,heartbeat,workerAlive,shops,backup,release:release?{commit:/^[a-f0-9]{40}$/.test(release.commit_sha)?release.commit_sha:null,version:/^\d+\.\d+\.\d+$/.test(release.version)?release.version:null,at:release.created_at}:null,push};
}
