import {lstat,mkdir,realpath,open,unlink,rmdir,statfs} from 'node:fs/promises';
import {constants,lstatSync,renameSync,unlinkSync} from 'node:fs';
import {join,resolve,parse,relative,sep} from 'node:path';
import {Readable,Transform,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {HostingError,hostingId,MAX_FILE_BYTES,UPLOAD_TIMEOUT_MS} from './types.ts';
import type {HostedEntry} from './types.ts';
import {folderChain,reserveEntry,finishEntry,auditHosting,hostingEntry,newHostingId} from './store.ts';

export const hostingRoot=()=>join(process.cwd(),'data','file-hosting');
export class HostingUploadMeter extends Transform {
  size=0;
  private hash=createHash('sha256');
  private limit:number;
  constructor(limit=MAX_FILE_BYTES){super();this.limit=limit;}
  override _transform(chunk:Buffer,_encoding:BufferEncoding,callback:(error?:Error|null,data?:Buffer)=>void) {
    this.size+=chunk.length;if(this.size>this.limit){callback(new HostingError('Egy fájl legfeljebb 1 GB lehet.',413));return;}this.hash.update(chunk);callback(null,chunk);
  }
  digest(){return this.hash.digest('hex');}
}
// Never follow a junction/symlink, including an ancestor of the dedicated root.
// IDs (not supplied names/paths) form physical storage paths. Existing NAS files
// are never registered/discovered. OS ACLs must exclude untrusted local writers.
async function safeDirectory(path:string,create=false) {
  const absolute=resolve(path),root=parse(absolute).root;
  let current=root;
  for(const part of relative(root,absolute).split(sep).filter(Boolean)){
    current=join(current,part);
    let stat;try{stat=await lstat(current);}catch(error){if(!create||(error as NodeJS.ErrnoException).code!=='ENOENT')throw error;try{await mkdir(current);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}stat=await lstat(current);}
    if(!stat.isDirectory()||stat.isSymbolicLink())throw new HostingError('A hosting tároló nem biztonságos vagy nem elérhető.',503);
    const actual=await realpath(current);if(resolve(actual).toLowerCase()!==resolve(current).toLowerCase())throw new HostingError('A hosting tároló átirányított elérési utat tartalmaz.',503);
  }
}
export async function entryPath(db:DatabaseSync,entry:HostedEntry,root=hostingRoot(),createRoot=false):Promise<string> {
  hostingId(entry.id);
  await safeDirectory(root,createRoot);let directory=root;
  for(const folder of folderChain(db,entry.parent_id)){directory=join(directory,folder.id);await safeDirectory(directory);}
  return join(directory,entry.id+(entry.kind==='file'?'.blob':''));
}
async function abandon(db:DatabaseSync,entry:HostedEntry,path:string|undefined,created:boolean) {
  // Delete only the exact object this operation created, never a pre-existing path.
  if(created&&path){try{if(entry.kind==='file')await unlink(path);else await rmdir(path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new HostingError('A félkész feltöltés takarítása nem sikerült; admin ellenőrzés szükséges.',503);}}
  db.prepare("DELETE FROM hosted_entries WHERE id=? AND state='uploading'").run(entry.id);
}
export async function recoverInterruptedUploads(db:DatabaseSync,actor:string,root=hostingRoot(),now=Date.now()) {
  const stale=db.prepare("SELECT * FROM hosted_entries WHERE state='uploading' AND created_at<?").all(now-2*UPLOAD_TIMEOUT_MS) as HostedEntry[];
  for(const entry of stale){
    const path=await entryPath(db,entry,root,true);
    let exists=false;try{const stat=await lstat(path);if(stat.isSymbolicLink()||(entry.kind==='file'&&(!stat.isFile()||stat.nlink!==1))||(entry.kind==='folder'&&!stat.isDirectory()))throw new HostingError('A félkész hosting objektum ellenőrzést igényel.',503);exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    await abandon(db,entry,path,exists);auditHosting(db,actor,'recover',entry.id,{interrupted:true},now);
  }
  return stale.length;
}
export async function createHostingFolder(db:DatabaseSync,parent:string|null,name:unknown,actor:string,root=hostingRoot()):Promise<HostedEntry> {
  await recoverInterruptedUploads(db,actor,root);
  const entry=reserveEntry(db,parent,name,'folder',actor);let path:string|undefined,created=false;
  try{path=await entryPath(db,entry,root,true);await mkdir(path);created=true;finishEntry(db,entry,0,null,actor);return {...entry,state:'ready'};}
  catch(error){await abandon(db,entry,path,created);throw error;}
}
export function uploadLength(request:Request):number|null {
  const text=request.headers.get('content-length');if(text===null)return null;
  if(!/^\d{1,12}$/.test(text))throw new HostingError('Érvénytelen feltöltési méret.');
  const bytes=Number(text);if(bytes>MAX_FILE_BYTES)throw new HostingError('Egy fájl legfeljebb 1 GB lehet.',413);return bytes;
}
export async function uploadHostedFile(db:DatabaseSync,parent:string|null,name:unknown,actor:string,request:Request,root=hostingRoot()):Promise<HostedEntry> {
  const expected=uploadLength(request);if(!request.body&&expected!==0)throw new HostingError('Hiányzó fájltartalom.');
  await recoverInterruptedUploads(db,actor,root);
  const entry=reserveEntry(db,parent,name,'file',actor);let path:string|undefined,created=false;
  try{
    path=await entryPath(db,entry,root,true);
    const disk=await statfs(root),otherUploads=Number(db.prepare("SELECT count(*) n FROM hosted_entries WHERE kind='file' AND state='uploading' AND id<>?").get(entry.id)!.n);
    const headroom=256*1024*1024;
    if(disk.bavail*disk.bsize<(expected??MAX_FILE_BYTES)+otherUploads*MAX_FILE_BYTES+headroom)throw new HostingError('Nincs elég biztonságosan használható szabad tárhely.',507);
    const handle=await open(path,'wx',0o600);created=true;
    const limiter=new HostingUploadMeter();
    const source=request.body?Readable.fromWeb(request.body as import('node:stream/web').ReadableStream):Readable.from([]);
    // A Writable owns no descriptor: explicit close below also covers aborts.
    let bytesSinceDiskCheck=0;
    const target=new Writable({write(chunk:Buffer,_encoding,callback){
      (async()=>{bytesSinceDiskCheck+=chunk.length;if(bytesSinceDiskCheck>=32*1024*1024){bytesSinceDiskCheck=0;const free=await statfs(root);if(free.bavail*free.bsize<headroom+chunk.length)throw new HostingError('A szabad tárhely elérte a biztonsági tartalékot.',507);}let offset=0;while(offset<chunk.length){const result=await handle.write(chunk,offset,chunk.length-offset);if(!result.bytesWritten)throw new Error('Incomplete disk write');offset+=result.bytesWritten;}})().then(()=>callback(),error=>callback(error));
    }});
    try{await pipeline(source,limiter,target,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(UPLOAD_TIMEOUT_MS)])});await handle.sync();}
    finally{await handle.close();}
    if(expected!==null&&limiter.size!==expected)throw new HostingError('A feltöltés hiányos; a fájl nem lett mentve.');
    const sha256=limiter.digest();finishEntry(db,entry,limiter.size,sha256,actor);return {...entry,state:'ready',size:limiter.size,sha256};
  }catch(error){await abandon(db,entry,path,created);throw error;}
}
export async function openHostedFile(db:DatabaseSync,entry:HostedEntry,root=hostingRoot()) {
  const path=await entryPath(db,entry,root),before=await lstat(path);
  if(before.isSymbolicLink()||!before.isFile()||before.nlink!==1)throw new HostingError('A fájl nem érhető el.',404);
  const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try{const stat=await handle.stat();if(!stat.isFile()||stat.nlink!==1||stat.size!==entry.size||stat.ino!==before.ino||stat.dev!==before.dev)throw new HostingError('A fájl nem érhető el.',404);return handle;}
  catch(error){await handle.close();throw error;}
}

export async function deleteHostedFile(db:DatabaseSync,id:string,actor:string,root=hostingRoot()) {
  const entry=hostingEntry(db,id);
  if(entry.kind!=='file'||entry.state!=='ready')throw new HostingError('Csak kész fájl törölhető.',409);
  const path=await entryPath(db,entry,root),discard=path+'.deleted-'+newHostingId();
  // No await inside the transaction: other requests use the same connection.
  // Rename is reversible until entry, audit and all links commit together.
  let moved=false;
  db.exec('BEGIN IMMEDIATE');
  try{
    const current=hostingEntry(db,id);if(current.kind!=='file'||current.state!=='ready')throw new HostingError('A fájl már nem törölhető.',409);
    const stat=lstatSync(path);
    if(stat.isSymbolicLink()||!stat.isFile()||stat.nlink!==1||stat.size!==entry.size)throw new HostingError('A fájl ellenőrzést igényel; nem töröltük.',503);
    renameSync(path,discard);moved=true;
    const links=db.prepare('DELETE FROM hosted_links WHERE file_id=?').run(id).changes;
    db.prepare('DELETE FROM hosted_entries WHERE id=?').run(id);
    auditHosting(db,actor,'delete',id,{name:entry.name,size:entry.size,links});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');if(moved)renameSync(discard,path);throw error;}
  try{unlinkSync(discard);}catch{throw new HostingError('A fájl és linkjei már nem érhetők el. A tárhely felszabadítása nem sikerült; admin ellenőrzés szükséges.',503);}
}
