import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, link, unlink, readFile, writeFile, readdir, lstat, mkdir, copyFile } from 'node:fs/promises';
import { join, relative,resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync, backup } from 'node:sqlite';
import { spawn } from 'node:child_process';

const magic=Buffer.from('WYDNAS01');
export type BackupSettings={version:1;installationId:string;retentionDays:number;cloudEnabled:boolean;remote:string;remoteDirectory:string};
export type BackupManifest={version:1;createdAt:string;sourceRoot:string;files:{path:string;size:number;sha256:string}[]};
export function verifyGoogleBackupConfig(text:string,clientId:string,remote='nas-drive',requireToken=true):void {
  let section='',seen=false;const values=new Map<string,string>();
  for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line || line.startsWith('#') || line.startsWith(';'))continue;
    if(line.startsWith('[')){section=line.slice(1,-1);if(section===remote){if(seen)throw new Error('Duplicate backup remote');seen=true;}continue;}
    if(section!==remote)continue;const equals=line.indexOf('=');if(equals<1)throw new Error('Invalid backup remote');const key=line.slice(0,equals).trim();if(values.has(key))throw new Error('Duplicate backup configuration value');values.set(key,line.slice(equals+1).trim());
  }
  if(!seen || values.get('type')!=='drive' || values.get('client_id')!==clientId || values.get('scope')!=='drive.file' || !values.get('client_secret') || values.get('service_account_file') || values.get('service_account_credentials'))throw new Error('Dedicated backup OAuth client and drive.file scope required');
  if(requireToken){const token=JSON.parse(values.get('token') || '{}');if(typeof token.refresh_token!=='string' || !token.refresh_token)throw new Error('Google offline authorization incomplete');}
}
export function archiveName(id:string,now=new Date()):string {
  if(!/^[a-f0-9]{12}$/.test(id))throw new Error('Invalid backup installation identifier');
  return `nas-${id}-${now.toISOString().replace(/[-:.]/g,'')}.nasbackup`;
}
export function ownedArchiveDate(name:string,id:string):number|null {
  if(!/^[a-f0-9]{12}$/.test(id))return null;
  const match=new RegExp(`^nas-${id}-(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})(\\d{3})Z\\.nasbackup$`).exec(name);
  if(!match)return null;
  const [,year,month,day,hour,minute,second,milliseconds]=match,date=`${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds}Z`,time=Date.parse(date);
  return Number.isFinite(time) && new Date(time).toISOString()===date ? time : null;
}
export async function fileHash(path:string):Promise<string> {
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');
}
function keyBuffer(key:string):Buffer {const bytes=Buffer.from(key,'base64');if(bytes.length!==32 || bytes.toString('base64')!==key)throw new Error('Invalid recovery key');return bytes;}
export async function encryptArchive(source:string,destination:string,key:string) {
  const bytes=keyBuffer(key),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',bytes,iv),partial=destination+'.partial';
  const handle=await open(partial,'wx');try{await handle.write(Buffer.concat([magic,iv]));}finally{await handle.close();}
  try{await pipeline(createReadStream(source),cipher,createWriteStream(partial,{flags:'a'}));const append=await open(partial,'a');try{await append.write(cipher.getAuthTag());}finally{await append.close();}await link(partial,destination);await unlink(partial);}
  catch(error){await unlink(partial).catch(()=>{});throw error;}finally{bytes.fill(0);}
}
export async function decryptArchive(source:string,destination:string,key:string) {
  const bytes=keyBuffer(key),handle=await open(source,'r');let size:number,header:Buffer,tag:Buffer;
  try{size=(await handle.stat()).size;if(size<36)throw new Error('Invalid encrypted backup');header=Buffer.alloc(20);tag=Buffer.alloc(16);await handle.read(header,0,20,0);await handle.read(tag,0,16,size-16);}finally{await handle.close();}
  if(!header.subarray(0,8).equals(magic))throw new Error('Unknown encrypted backup format');
  const decipher=createDecipheriv('aes-256-gcm',bytes,header.subarray(8));decipher.setAuthTag(tag);const partial=destination+'.partial';
  // Acquire the partial exclusively before cleanup is allowed; never remove another run's file.
  const reserved=await open(partial,'wx');await reserved.close();
  try{await pipeline(createReadStream(source,{start:20,end:size-17}),decipher,createWriteStream(partial,{flags:'a'}));await link(partial,destination);await unlink(partial);}
  catch(error){await unlink(partial).catch(()=>{});throw error;}finally{bytes.fill(0);}
}
export async function command(executable:string,args:string[],timeout=30*60_000):Promise<string> {
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',overflow=false;
    child.stdout.on('data',chunk=>{if(output.length+chunk.length>4*1024*1024){overflow=true;child.kill();}else output+=String(chunk);});
    // Never surface stderr: provider responses can contain credentials or private filenames.
    child.stderr.resume();const timer=setTimeout(()=>{child.kill();reject(new Error('Backup command timed out'));},timeout);
    child.once('error',()=>{clearTimeout(timer);reject(new Error('Backup command could not start'));});
    child.once('close',code=>{clearTimeout(timer);if(code!==0 || overflow)reject(new Error('Backup command failed'+(code===null ? '' : ` (exit ${code})`)));else resolve(output);});
  });
}
export async function snapshotDatabase(source:string,destination:string) {
  const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,destination);}finally{db.close();}
  const snapshot=new DatabaseSync(destination,{readOnly:true});try{
    const integrity=snapshot.prepare('PRAGMA integrity_check').all();if(integrity.length!==1 || integrity[0].integrity_check!=='ok')throw new Error('SQLite backup failed integrity check');
    if(snapshot.prepare('PRAGMA foreign_key_check').all().length)throw new Error('SQLite backup failed foreign-key check');
  }finally{snapshot.close();}
}
export async function prepareStage(root:string,stage:string,now=new Date()):Promise<BackupManifest> {
  await mkdir(stage,{recursive:true});
  async function copy(from:string,to:string,filter?:(path:string,name:string)=>boolean){
    const stat=await lstat(from);if(stat.isSymbolicLink())throw new Error('Backup cannot follow filesystem links');
    if(stat.isDirectory()){await mkdir(to,{recursive:true});for(const entry of await readdir(from)){if(filter && !filter(from,entry))continue;await copy(join(from,entry),join(to,entry),filter);}}else if(stat.isFile()){await mkdir(join(to,'..'),{recursive:true});await copyFile(from,to);}
  }
  const exclude=new Set(['node_modules','.runtime','data','logs','.git','.next','.next-staging','.next-previous']);
  for(const entry of await readdir(root)){
    if(exclude.has(entry) || entry.startsWith('.next-backup-') || entry.endsWith('.tsbuildinfo') || entry==='MOVED-TO-D.txt')continue;
    await copy(join(root,entry),join(stage,entry),(path,name)=>name!=='.gradle' && !(relative(root,path).split(/[\\/]/)[0]==='android' && name==='build'));
  }
  await mkdir(join(stage,'data'),{recursive:true});await snapshotDatabase(join(root,'data/dashboard.sqlite'),join(stage,'data/dashboard.sqlite'));
  for(const path of ['data/caddy','.runtime/secrets','.runtime/android-signing','.runtime/artifacts','.runtime/services','.runtime/opencode-gateway','.runtime/admin-helper-client','.runtime/deployment-client']){
    try{await lstat(join(root,path));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
    await copy(join(root,path),join(stage,path));
  }
  // Worker-only immutable releases are needed by restored service XML; never
  // duplicate all web/APK rollback builds into the daily cloud archive.
  const releases=join(root,'.runtime/deployment/releases');
  try{
    const releaseStat=await lstat(releases);if(!releaseStat.isDirectory() || releaseStat.isSymbolicLink())throw new Error('Unsafe deployment release directory');
    for(const id of await readdir(releases))if(/^[a-f0-9]{32}$/.test(id)){
      const entry=await lstat(join(releases,id));if(!entry.isDirectory() || entry.isSymbolicLink())throw new Error('Unsafe worker release path');
      const worker=join(releases,id,'worker');let exists=false;try{await lstat(worker);exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      if(exists)await copy(worker,join(stage,'.runtime/deployment/releases',id,'worker'));
    }
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  // Approved protected Windows component; archive into the project recovery tree,
  // never restore directly into privileged Program Files or enable a Windows service.
  if(process.platform==='win32' && resolve(root)===resolve(process.cwd())){
    for(const [component,recovery] of [['Wydrian NAS Admin Helper','.runtime/admin-helper-recovery'],['Wydrian NAS Deployer','.runtime/deployer-recovery']]){
    const helper=join(process.env.ProgramFiles || process.env.PROGRAMFILES || 'C:\\Program Files',component);
    let installed=false;try{await lstat(join(helper,'installation.json'));installed=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(installed){
      const destination=join(stage,recovery);
      await copy(helper,destination,(parent,name)=>!(parent===helper && ['data','jdk','node.exe','aapt.exe','apksigner.jar'].includes(name)));
      const data=join(helper,'data'),target=join(destination,'data');await mkdir(target,{recursive:true});
      const dataStat=await lstat(data),stateStat=await lstat(join(data,'state.json'));
      if(!dataStat.isDirectory() || dataStat.isSymbolicLink() || !stateStat.isFile() || stateStat.isSymbolicLink())throw new Error('Unsafe helper state path');
      // Node readFile shares delete on Windows: the broker's atomic File.Replace
      // remains possible. Never CopyFile its live state/new/previous files.
      const state=await readFile(join(data,'state.json'),'utf8');if(!Array.isArray(JSON.parse(state)))throw new Error('Invalid helper backup state');
      await writeFile(join(target,'state.json'),state);
      if(component==='Wydrian NAS Deployer'){
        const value=await readFile(join(data,'worker-hash.txt'),'utf8');if(!/^[a-f0-9]{64}$/.test(value.trim()))throw new Error('Invalid worker configuration backup hash');await writeFile(join(target,'worker-hash.txt'),value);
      }
      for(const name of await readdir(data))if(/^audit-\d{4}-\d{2}\.jsonl$/.test(name)){
        const path=join(data,name),stat=await lstat(path);if(!stat.isFile() || stat.isSymbolicLink())throw new Error('Unsafe helper audit path');
        const bytes=await readFile(path),end=bytes.lastIndexOf(10)+1;
        await writeFile(join(target,name),bytes.subarray(0,end)); // Only complete captured audit records.
      }
    }
    }
  }
  const files:BackupManifest['files']=[];
  async function walk(path:string){for(const name of await readdir(path)){const full=join(path,name),stat=await lstat(full);if(stat.isDirectory())await walk(full);else files.push({path:relative(stage,full).replaceAll('\\','/'),size:stat.size,sha256:await fileHash(full)});}}
  await walk(stage);const manifest:BackupManifest={version:1,createdAt:now.toISOString(),sourceRoot:root,files};await writeFile(join(stage,'backup-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
export async function verifyStage(stage:string):Promise<BackupManifest> {
  const manifest=JSON.parse(await readFile(join(stage,'backup-manifest.json'),'utf8')) as BackupManifest;
  if(manifest.version!==1 || !Array.isArray(manifest.files))throw new Error('Invalid backup manifest');
  for(const file of manifest.files){if(typeof file.path!=='string' || !file.path || file.path.split('/').some(part=>part==='' || part==='.' || part==='..') || file.path.includes('\\') || file.path.includes(':'))throw new Error('Unsafe backup manifest path');
    let parent=stage;for(const part of file.path.split('/').slice(0,-1)){parent=join(parent,part);const stat=await lstat(parent);if(!stat.isDirectory() || stat.isSymbolicLink())throw new Error('Unsafe backup manifest directory');}
    const full=join(stage,file.path),stat=await lstat(full);if(!stat.isFile() || stat.size!==file.size || await fileHash(full)!==file.sha256)throw new Error('Restored backup manifest mismatch');}
  const db=new DatabaseSync(join(stage,'data/dashboard.sqlite'),{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get()!.integrity_check!=='ok')throw new Error('Restored SQLite failed integrity check');}finally{db.close();}return manifest;
}
