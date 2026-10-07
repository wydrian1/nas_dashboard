import type {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {HostingError,hostingId,hostingName,MAX_FILE_BYTES} from './types.ts';
import type {HostedEntry,HostedLink,HostingListing} from './types.ts';
import {plainSqlRow} from '../sql-rows.ts';

export const newHostingId=()=>randomBytes(16).toString('hex');
export function auditHosting(db:DatabaseSync,actor:string,action:string,id:string,detail:unknown,now=Date.now()) {
  db.prepare('INSERT INTO hosted_audit(actor,action,entry_id,detail_json,occurred_at) VALUES(?,?,?,?,?)').run(actor,action,id,JSON.stringify(detail),now);
}
export function hostingEntry(db:DatabaseSync,id:string):HostedEntry {
  const entry=db.prepare('SELECT id,parent_id,name,kind,state,size,sha256,created_at FROM hosted_entries WHERE id=?').get(hostingId(id)) as HostedEntry|undefined;
  if(!entry)throw new HostingError('A fájl vagy mappa nem található.',404);return plainSqlRow(entry);
}
export function folderChain(db:DatabaseSync,parent:string|null):HostedEntry[] {
  const chain:HostedEntry[]=[];
  while(parent){if(chain.length>=16||chain.some(item=>item.id===parent))throw new HostingError('Legfeljebb 16 mappaszint kezelhető.');const entry=hostingEntry(db,parent);if(entry.kind!=='folder'||entry.state!=='ready')throw new HostingError('Nem elérhető mappa.',404);chain.unshift(entry);parent=entry.parent_id;}
  return chain;
}
export function reserveEntry(db:DatabaseSync,parent:string|null,nameValue:unknown,kind:'file'|'folder',actor:string,now=Date.now()):HostedEntry {
  const name=hostingName(nameValue);folderChain(db,parent);
  if(kind==='folder'&&folderChain(db,parent).length>=16)throw new HostingError('Legfeljebb 16 mappaszint kezelhető.');
  db.exec('BEGIN IMMEDIATE');try{
    if(Number(db.prepare('SELECT count(*) n FROM hosted_entries').get()!.n)>=10000)throw new HostingError('A tároló legfeljebb 10 000 bejegyzést kezel.',409);
    if(Number(db.prepare('SELECT count(*) n FROM hosted_entries WHERE parent_id IS ?').get(parent)!.n)>=500)throw new HostingError('Egy mappában legfeljebb 500 bejegyzés lehet.',409);
    if(db.prepare('SELECT 1 FROM hosted_entries WHERE parent_id IS ? AND name_key=?').get(parent,name.toLowerCase()))throw new HostingError('Ilyen nevű fájl vagy mappa már létezik; nem írjuk felül.',409);
    if(Number(db.prepare("SELECT count(*) n FROM hosted_entries WHERE state='uploading'").get()!.n)>=2)throw new HostingError('Két művelet már folyamatban van. Próbáld később.',429);
    const id=newHostingId();db.prepare("INSERT INTO hosted_entries(id,parent_id,name,name_key,kind,state,actor,created_at) VALUES(?,?,?,?,?,'uploading',?,?)").run(id,parent,name,name.toLowerCase(),kind,actor,now);db.exec('COMMIT');return hostingEntry(db,id);
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function finishEntry(db:DatabaseSync,entry:HostedEntry,size:number,sha256:string|null,actor:string) {
  db.exec('BEGIN IMMEDIATE');try{
    if(db.prepare("UPDATE hosted_entries SET state='ready',size=?,sha256=? WHERE id=? AND state='uploading'").run(size,sha256,entry.id).changes!==1)throw new HostingError('A feltöltési művelet már nem aktív.',409);
    auditHosting(db,actor,entry.kind==='folder'?'mkdir':'upload',entry.id,{name:entry.name,size,sha256});db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function listing(db:DatabaseSync,parent:string|null):HostingListing {
  const breadcrumbs=folderChain(db,parent),entries=(db.prepare('SELECT id,parent_id,name,kind,state,size,sha256,created_at FROM hosted_entries WHERE parent_id IS ? ORDER BY kind DESC,name_key').all(parent) as HostedEntry[]).map(plainSqlRow);
  const links=(db.prepare("SELECT l.id,l.file_id,l.expires_at,l.revoked_at,l.created_at FROM hosted_links l JOIN hosted_entries e ON e.id=l.file_id WHERE e.parent_id IS ? AND e.state='ready' ORDER BY l.created_at DESC").all(parent) as HostedLink[]).map(plainSqlRow);
  return {folder:breadcrumbs.at(-1)??null,breadcrumbs,entries,links,maxFileBytes:MAX_FILE_BYTES};
}
function key(secret:string) {if(secret.length<32)throw new HostingError('A megosztási aláírókulcs nincs biztonságosan beállítva.',503);return secret;}
export function signHostingLink(id:string,secret:string):string {
  if(!/^[a-f0-9]{64}$/.test(id))throw new HostingError('Érvénytelen megosztás.');
  return id+'.'+createHmac('sha256',key(secret)).update('wydrian:file-hosting:v1:'+id).digest('base64url');
}
export function createHostingLink(db:DatabaseSync,fileId:string,expiresAt:unknown,actor:string,secret:string,now=Date.now()):HostedLink {
  key(secret);const file=hostingEntry(db,fileId);if(file.kind!=='file'||file.state!=='ready')throw new HostingError('Csak kész fájl osztható meg.');
  if(expiresAt!==null&&(typeof expiresAt!=='number'||!Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt>now+3650*86400000))throw new HostingError('A lejárat jövőbeli időpont legyen, legfeljebb 10 évre.');
  db.exec('BEGIN IMMEDIATE');try{
    if(Number(db.prepare('SELECT count(*) n FROM hosted_links WHERE file_id=?').get(fileId)!.n)>=100)throw new HostingError('Fájlonként legfeljebb 100 megosztási link kezelhető.',409);
    const id=randomBytes(32).toString('hex');db.prepare('INSERT INTO hosted_links(id,file_id,expires_at,actor,created_at) VALUES(?,?,?,?,?)').run(id,fileId,expiresAt as number|null,actor,now);auditHosting(db,actor,'share',fileId,{linkId:id,expiresAt},now);db.exec('COMMIT');return {id,file_id:fileId,expires_at:expiresAt as number|null,revoked_at:null,created_at:now};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function revokeHostingLink(db:DatabaseSync,id:unknown,actor:string,now=Date.now()) {
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new HostingError('Érvénytelen megosztás.');
  db.exec('BEGIN IMMEDIATE');try{
    const link=db.prepare('SELECT * FROM hosted_links WHERE id=?').get(id) as HostedLink|undefined;if(!link)throw new HostingError('A megosztás nem található.',404);
    if(link.revoked_at===null){db.prepare('UPDATE hosted_links SET revoked_at=? WHERE id=?').run(now,id);auditHosting(db,actor,'revoke',link.file_id,{linkId:id},now);}db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function resolveHostingLink(db:DatabaseSync,token:string,secret:string,now=Date.now()):HostedEntry {
  const missing=()=>new HostingError('A megosztás nem érhető el.',404);
  if(!/^[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(token))throw missing();
  const id=token.slice(0,64),expected=Buffer.from(signHostingLink(id,secret)),actual=Buffer.from(token);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw missing();
  const link=db.prepare('SELECT * FROM hosted_links WHERE id=?').get(id) as HostedLink|undefined;
  if(!link||link.revoked_at!==null||(link.expires_at!==null&&link.expires_at<=now))throw missing();
  const file=hostingEntry(db,link.file_id);if(file.kind!=='file'||file.state!=='ready')throw missing();return file;
}
