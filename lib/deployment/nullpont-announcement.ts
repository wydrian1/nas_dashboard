import {createHash} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute,join,resolve,relative,sep} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {roleFor} from '../users.ts';

export const NULLPONT_PUBLIC_URL='https://wydrian.hu/nullpont';
export function nullpontInstalledDirectory(value:unknown):string {
  // Accept the two separator spellings of the one approved installed root only.
  // Do not normalize caller-controlled traversal/relative/UNC/alternate-drive aliases.
  if(value!=='D:\\!nullpont'&&value!=='D:/!nullpont')throw new Error('Exact installed NULLPONT root required');
  return 'D:\\!nullpont';
}
export const sha256=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const hash=/^[a-f0-9]{64}$/,commitPattern=/^[a-f0-9]{40}$/;
const requiredChecks=['approved','storyApproved','sourceCommitVerified','packageVerified','backupVerified','serviceTargetVerified','localHealth','publicHealth','dataPreserved','rollbackNotNeeded'];
type VerifiedRelease={commit:string;manifestSha256:string;version:string};

// This is an operator's private local attestation, NOT a signed dashboard broker receipt.
// Approval pins are supplied independently by the deployment owner, not taken from the file.
export function verifyNullpontDeployment(text:string,pins:{evidenceSha256:string;commit:string;manifestSha256:string;releaseDirectory:string},now=Date.now()):VerifiedRelease {
  if(!hash.test(pins.evidenceSha256)||!hash.test(pins.manifestSha256)||!commitPattern.test(pins.commit)||sha256(text)!==pins.evidenceSha256||!isAbsolute(pins.releaseDirectory))throw new Error('Deployment approval pins rejected');
  const result=JSON.parse(text);
  if(result.schemaVersion!==1||result.application!=='nullpont'||result.state!=='succeeded'||result.phase!=='complete'||result.errorCode!==0||result.url!==NULLPONT_PUBLIC_URL||result.commit!==pins.commit||result.manifestSha256!==pins.manifestSha256||result.releaseDirectory!==pins.releaseDirectory||!Number.isSafeInteger(result.completedAt)||result.completedAt>now||now-result.completedAt>15*60_000||!requiredChecks.every(name=>result.checks?.[name]===true))throw new Error('Completed NULLPONT deployment evidence rejected');
  const root=resolve(pins.releaseDirectory);
  // Reject junctions/symlinks in the installed package and its ancestors.
  function unlinked(path:string){let current=resolve(path);for(;;){if(lstatSync(current).isSymbolicLink())throw new Error('Linked deployment artifact rejected');const parent=resolve(current,'..');if(parent===current)break;current=parent;}}
  function artifact(path:string){if(typeof path!=='string'||!path||path.includes('\\')||path.includes(':')||path.split('/').some(part=>!part||part==='.'||part==='..')||isAbsolute(path))throw new Error('Package path rejected');const file=join(root,path);if(relative(root,file).startsWith('..'+sep))throw new Error('Package path escaped');unlinked(file);const stat=lstatSync(file);if(!stat.isFile()||stat.nlink!==1)throw new Error('Package file rejected');return readFileSync(file);}
  const manifestBytes=artifact('release-manifest.json');
  if(sha256(manifestBytes)!==pins.manifestSha256)throw new Error('Installed package manifest mismatch');
  const manifest=JSON.parse(manifestBytes.toString('utf8'));
  if(manifest.application!=='nullpont'||typeof manifest.version!=='string'||!/^\d+\.\d+\.\d+$/.test(manifest.version)||!['tests','typecheck','build','browser'].every(name=>manifest.checks?.[name]===true)||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('Verified release package required');
  const seen=new Set<string>();
  for(const file of manifest.files){if(seen.has(file.path)||!hash.test(file.sha256)||!Number.isSafeInteger(file.size)||file.size<0)throw new Error('Package entry rejected');seen.add(file.path);const bytes=artifact(file.path);if(bytes.length!==file.size||sha256(bytes)!==file.sha256)throw new Error('Installed package artifact mismatch');}
  if(!seen.has('package.json')||!seen.has('.next/BUILD_ID')||!seen.has('.next/required-server-files.json')||!Array.from(seen).some(path=>path.startsWith('lib/')))throw new Error('Incomplete installed package');
  if(JSON.parse(artifact('package.json').toString('utf8')).version!==manifest.version||artifact('.next/BUILD_ID').toString('utf8').trim()!==result.buildId||typeof result.buildId!=='string'||!result.buildId)throw new Error('Installed release identity mismatch');
  return {commit:pins.commit,manifestSha256:pins.manifestSha256,version:manifest.version};
}

export function queueNullpontDeployment(db:DatabaseSync,release:VerifiedRelease,now=Date.now()){
  if(!commitPattern.test(release.commit)||!hash.test(release.manifestSha256)||!/^\d+\.\d+\.\d+$/.test(release.version))throw new Error('Invalid NULLPONT release identity');
  const id=sha256('nullpont\n'+release.commit+'\n'+release.manifestSha256).slice(0,32);
  db.exec('BEGIN IMMEDIATE');try{
    const previous=db.prepare('SELECT commit_sha,version FROM release_announcements WHERE id=?').get(id);
    if(previous){if(previous.commit_sha!==release.commit||previous.version!==release.version)throw new Error('Release identity collision');db.exec('COMMIT');return 0;}
    const devices=db.prepare("SELECT d.id,d.email FROM mobile_devices d JOIN dashboard_users u ON u.email=d.email WHERE u.active=1 AND u.role='admin' AND d.revoked=0 AND d.push_enabled=1 AND d.fcm_token IS NOT NULL AND d.fcm_token<>'' AND d.expires_at>?").all(now).filter(device=>roleFor(db,device.email)==='admin');
    if(!devices.length)throw new Error('No active opted-in admin device; nothing queued');
    db.prepare('INSERT INTO release_announcements(id,commit_sha,version,created_at) VALUES(?,?,?,?)').run(id,release.commit,release.version,now);
    // Existing Android notification routing permits only dashboard paths. The exact public
    // game URL is in the fixed body; tapping opens dashboard home (no APK change required).
    const payload=JSON.stringify({kind:'release',eventId:'release-'+id,title:'NULLPONT · sikeres élesítés',body:'A NULLPONT új kiadása sikeresen élesítve. '+NULLPONT_PUBLIC_URL,path:'/'});
    for(const device of devices)db.prepare('INSERT INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES(?,?,?,?,?)').run('release-'+id+'-'+device.id,device.id,payload,now,now+15*60_000);
    db.exec('COMMIT');return devices.length;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
