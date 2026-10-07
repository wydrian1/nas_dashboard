import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile,symlink,link} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {initializeDatabase} from '../lib/db-schema.ts';
import {hostingName,hostingId,MAX_FILE_BYTES,HostingError} from '../lib/file-hosting/types.ts';
import {listing,reserveEntry,finishEntry,folderChain,hostingEntry,createHostingLink,signHostingLink,resolveHostingLink,revokeHostingLink} from '../lib/file-hosting/store.ts';
import {createHostingFolder,uploadHostedFile,entryPath,uploadLength,recoverInterruptedUploads,HostingUploadMeter} from '../lib/file-hosting/storage.ts';
import {hostingDownload,fileRange,fileDownloadHeaders} from '../lib/file-hosting/download.ts';
import {prepareStage,verifyStage} from '../lib/backup.ts';

const secret='synthetic-signing-key-'.repeat(3),actor='owner@example.com';
async function fixture(){const parent=join(process.cwd(),'.runtime/research');await mkdir(parent,{recursive:true});const directory=await mkdtemp(join(parent,'hosting-test-')),root=join(directory,'storage'),db=new DatabaseSync(':memory:');initializeDatabase(db);return {db,root,directory,close:async()=>{db.close();await rm(directory,{recursive:true,force:true});}};}
const uploadRequest=(body:string|ReadableStream<Uint8Array>,headers:Record<string,string>={},signal?:AbortSignal)=>new Request('https://nas.wydrian.hu/api/files/upload',{method:'POST',body,headers,signal,duplex:'half'} as RequestInit);
test('hosting names reject traversal, ADS, Windows devices, controls, invalid Unicode and aliases; accept safe Unicode',()=>{
  for(const name of ['','..','.env.local','../file','folder/file','x\\file','C:foo','CON','nul.zip','LPT1.txt','COM¹.txt','x\u0000y','x\r\ny','a.',' a','a ','<script>','\ud800','a\u202eb','a'.repeat(181)])assert.throws(()=>hostingName(name),HostingError);
  assert.equal(hostingName('Árvíztűrő tükörfúrógép.csv'),'Árvíztűrő tükörfúrógép.csv');assert.throws(()=>hostingId('../secrets'));assert.equal(MAX_FILE_BYTES,1_000_000_000);
});
test('folder creation uses isolated opaque physical IDs; raw streaming upload preserves bytes/hash and refuses collisions',async()=>{
  const f=await fixture();try{
    const folder=await createHostingFolder(f.db,null,'Dokumentumok',actor,f.root),nested=await createHostingFolder(f.db,folder.id,'2026',actor,f.root);
    const payload='Binary\u0000 file ő',file=await uploadHostedFile(f.db,nested.id,'Teszt.txt',actor,uploadRequest(payload),f.root);
    assert.equal(await readFile(await entryPath(f.db,file,f.root),'utf8'),payload);assert.equal(file.size,Buffer.byteLength(payload));assert.equal(file.sha256,createHash('sha256').update(payload).digest('hex'));
    await assert.rejects(()=>entryPath(f.db,{...file,id:'../external'},f.root));initializeDatabase(f.db);assert.equal(hostingEntry(f.db,file.id).sha256,file.sha256);
    assert.deepEqual(folderChain(f.db,nested.id).map(x=>x.name),['Dokumentumok','2026']);assert.equal(listing(f.db,nested.id).entries[0].name,'Teszt.txt');assert.equal(Object.getPrototypeOf(listing(f.db,nested.id).entries[0]),Object.prototype);
    await assert.rejects(()=>uploadHostedFile(f.db,nested.id,'TESZT.txt',actor,uploadRequest('Overwrite'),f.root),/létezik/);await assert.rejects(()=>createHostingFolder(f.db,nested.id,'Teszt.txt',actor,f.root),/létezik/);assert.equal(await readFile(await entryPath(f.db,file,f.root),'utf8'),payload);
    assert.equal(f.db.prepare('SELECT count(*) n FROM hosted_audit').get()!.n,3);assert.equal(f.db.prepare('SELECT count(*) n FROM finance_months').get()!.n,0);assert.equal(f.db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{await f.close();}
});
test('hosting signed links are file-scoped, persistent, expiry-bound, constant-time validated and revocable',async()=>{
  const f=await fixture();try{
    const file=await uploadHostedFile(f.db,null,'share.bin',actor,uploadRequest('bytes'),f.root),now=1000000;
    const permanent=createHostingLink(f.db,file.id,null,actor,secret,now),timed=createHostingLink(f.db,file.id,now+1000,actor,secret,now);
    const token=signHostingLink(timed.id,secret);assert.equal(resolveHostingLink(f.db,token,secret,now+999).id,file.id);assert.throws(()=>resolveHostingLink(f.db,token,secret,now+1000),/nem érhető/);assert.equal(resolveHostingLink(f.db,signHostingLink(permanent.id,secret),secret,Number.MAX_SAFE_INTEGER-1).id,file.id);
    for(const bad of [token.replace(/.$/,token.endsWith('A')?'B':'A'),'x',token+'.x',token.replace(timed.id,permanent.id)])assert.throws(()=>resolveHostingLink(f.db,bad,secret,now),/nem érhető/);assert.throws(()=>resolveHostingLink(f.db,token,'different-key-'.repeat(4),now));
    revokeHostingLink(f.db,permanent.id,actor,now+1);assert.throws(()=>resolveHostingLink(f.db,signHostingLink(permanent.id,secret),secret,now+2));revokeHostingLink(f.db,permanent.id,actor,now+3);
    for(const expires of [now,NaN,'10000',now+3651*86400000])assert.throws(()=>createHostingLink(f.db,file.id,expires,actor,secret,now));assert.throws(()=>createHostingLink(f.db,file.id,null,actor,'short',now));
    const folder=await createHostingFolder(f.db,null,'Folder',actor,f.root);assert.throws(()=>createHostingLink(f.db,folder.id,null,actor,secret));assert.equal(listing(f.db,null).links.length,2);
  }finally{await f.close();}
});
test('download streams bytes without inline rendering, supports HEAD/single ranges/suffix/empty files and rejects unsatisfiable ranges',async()=>{
  const f=await fixture();try{
    const file=await uploadHostedFile(f.db,null,'ő html.html',actor,uploadRequest('0123456789'),f.root);
    for(const [range,status,expected]of [[null,200,'0123456789'],['bytes=2-4',206,'234'],['bytes=-3',206,'789'],['bytes=8-',206,'89'],['bytes=8-500',206,'89']] as const){const response=await hostingDownload(f.db,file,new Request('https://example.com',{headers:range?{range}:{}}),f.root);assert.equal(response.status,status);assert.equal(await response.text(),expected);assert.match(response.headers.get('content-disposition')!,/^attachment/);assert.match(response.headers.get('content-disposition')!,/filename\*=UTF-8''/);assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');}
    const head=await hostingDownload(f.db,file,new Request('https://example.com',{method:'HEAD',headers:{range:'bytes=1-2'}}),f.root);assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
    const invalid=await hostingDownload(f.db,file,new Request('https://example.com',{headers:{range:'bytes=10-20'}}),f.root);assert.equal(invalid.status,416);assert.equal(invalid.headers.get('content-range'),'bytes */10');
    const matching=await hostingDownload(f.db,file,new Request('https://example.com',{headers:{range:'bytes=0-2','if-range':'"'+file.sha256+'"'}}),f.root);assert.equal(matching.status,206);assert.equal(await matching.text(),'012');const changed=await hostingDownload(f.db,file,new Request('https://example.com',{headers:{range:'bytes=0-2','if-range':'"different"'}}),f.root);assert.equal(changed.status,200);assert.equal(await changed.text(),'0123456789');
    const empty=await uploadHostedFile(f.db,null,'empty',actor,new Request('https://example.com',{method:'POST',headers:{'content-length':'0'}}),f.root);assert.equal(empty.size,0);assert.equal(await(await hostingDownload(f.db,empty,new Request('https://example.com'),f.root)).text(),'');assert.match(fileDownloadHeaders(file).get('content-security-policy')!,/sandbox/);
  }finally{await f.close();}
});
test('download backpressure leaves bounded streams open, parallel-file cap applies, and cancellation releases descriptors/slots',async()=>{
  const f=await fixture(),responses:Response[]=[];
  try{
    const file=await uploadHostedFile(f.db,null,'large.bin',actor,uploadRequest('a'.repeat(1024*1024)),f.root);
    for(let i=0;i<4;i++)responses.push(await hostingDownload(f.db,file,new Request('https://example.com'),f.root));
    await assert.rejects(()=>hostingDownload(f.db,file,new Request('https://example.com'),f.root),error=>error instanceof HostingError&&error.status===429);
    await Promise.all(responses.map(response=>response.body!.cancel()));responses.length=0;
    // FileReadStream.close releases the slot asynchronously after WebStream cancel.
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    const response=await hostingDownload(f.db,file,new Request('https://example.com'),f.root);assert.equal((await response.arrayBuffer()).byteLength,1024*1024);
  }finally{await Promise.all(responses.map(response=>response.body?.cancel()));await f.close();}
});
test('upload checks declared and actual bounds, truncation, stream errors and aborts; incomplete bytes/rows are removed',async()=>{
  const f=await fixture();try{
    assert.throws(()=>uploadLength(uploadRequest('x',{'content-length':String(MAX_FILE_BYTES+1)})),error=>error instanceof HostingError&&error.status===413);
    await assert.rejects(()=>uploadHostedFile(f.db,null,'large',actor,uploadRequest('x',{'content-length':String(MAX_FILE_BYTES+1)}),f.root));
    await assert.rejects(()=>uploadHostedFile(f.db,null,'truncated',actor,uploadRequest('abc',{'content-length':'10'}),f.root),/hiányos/);
    const broken=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(Buffer.from('partial'));controller.error(new Error('broken'));}});await assert.rejects(()=>uploadHostedFile(f.db,null,'broken',actor,uploadRequest(broken),f.root));
    const abort=new AbortController();abort.abort();await assert.rejects(()=>uploadHostedFile(f.db,null,'aborted',actor,uploadRequest('x',{},abort.signal),f.root));
    assert.equal(listing(f.db,null).entries.length,0);assert.equal(f.db.prepare('SELECT count(*) n FROM hosted_audit').get()!.n,0);assert.deepEqual(await readdir(f.root),[]);
    const meter=new HostingUploadMeter(8);await assert.rejects(pipeline(Readable.from([Buffer.alloc(5),Buffer.alloc(5)]),meter,new Writable({write(_chunk,_encoding,callback){callback();}})),error=>error instanceof HostingError&&error.status===413);assert.equal(meter.size,10);
  }finally{await f.close();}
});
test('interrupted uploads recover only old hosting-owned rows; active uploads cannot be shared and slots/depth are bounded',async()=>{
  const f=await fixture();try{
    const old=reserveEntry(f.db,null,'old','file',actor,Date.now()-3*3600000);const path=await entryPath(f.db,old,f.root,true);await writeFile(path,'partial');
    assert.throws(()=>createHostingLink(f.db,old.id,null,actor,secret));assert.equal(await recoverInterruptedUploads(f.db,actor,f.root),1);assert.throws(()=>hostingEntry(f.db,old.id));assert.deepEqual(await readdir(f.root),[]);
    const a=reserveEntry(f.db,null,'a','file',actor),b=reserveEntry(f.db,null,'b','file',actor);assert.throws(()=>reserveEntry(f.db,null,'c','file',actor),error=>error instanceof HostingError&&error.status===429);assert.equal(await recoverInterruptedUploads(f.db,actor,f.root),0);f.db.prepare('DELETE FROM hosted_entries WHERE id IN (?,?)').run(a.id,b.id);
    let parent:string|null=null;for(let i=0;i<16;i++)parent=(await createHostingFolder(f.db,parent,'level'+i,actor,f.root)).id;await assert.rejects(()=>createHostingFolder(f.db,parent,'Too deep',actor,f.root));
  }finally{await f.close();}
});
test('hosting refuses junction/symlink paths and hardlinks, does not read or overwrite external NAS content',async()=>{
  const f=await fixture();try{
    const external=join(f.directory,'external');await mkdir(external);await writeFile(join(external,'private'),'preserved');await symlink(external,f.root,'junction');
    await assert.rejects(()=>createHostingFolder(f.db,null,'bad',actor,f.root));assert.equal(await readFile(join(external,'private'),'utf8'),'preserved');assert.equal(listing(f.db,null).entries.length,0);await rm(f.root);await mkdir(f.root);
    const file=await uploadHostedFile(f.db,null,'file',actor,uploadRequest('source'),f.root),path=await entryPath(f.db,file,f.root);await link(path,join(external,'hardlink'));await assert.rejects(()=>hostingDownload(f.db,file,new Request('https://example.com'),f.root));await rm(join(external,'hardlink'));
    await writeFile(path,'different-size');await assert.rejects(()=>hostingDownload(f.db,file,new Request('https://example.com'),f.root));
    await rm(path);await symlink(join(external,'private'),path,'file');await assert.rejects(()=>hostingDownload(f.db,file,new Request('https://example.com'),f.root));assert.equal(await readFile(join(external,'private'),'utf8'),'preserved');
  }finally{await f.close();}
});
test('range parser rejects multipart, malformed and unsafe integers without reading a file',()=>{
  for(const range of ['bytes=0-1,3-4','bytes=-0','bytes=','bytes=-','bytes=5-2','items=0-1','bytes=9007199254740993-','bytes=0-9007199254740993'])assert.throws(()=>fileRange(range,10));assert.deepEqual(fileRange('bytes=-30',10),{start:0,end:9});assert.throws(()=>fileRange('bytes=0-',0));
});
test('backup stage preserves hosting bytes and metadata together; signed links work against isolated restored data',async()=>{
  const f=await fixture(),project=join(f.directory,'project'),stage=join(f.directory,'stage');await mkdir(join(project,'data'),{recursive:true});const source=new DatabaseSync(join(project,'data/dashboard.sqlite'));initializeDatabase(source);
  try{
    const sourceRoot=join(project,'data/file-hosting'),folder=await createHostingFolder(source,null,'Backup folder',actor,sourceRoot),file=await uploadHostedFile(source,folder.id,'preserved.txt',actor,uploadRequest('preserved binary content'),sourceRoot),link=createHostingLink(source,file.id,null,actor,secret);
    const manifest=await prepareStage(project,stage);await verifyStage(stage);assert.ok(manifest.files.some(entry=>entry.path==='data/file-hosting/'+folder.id+'/'+file.id+'.blob'));
    const restored=new DatabaseSync(join(stage,'data/dashboard.sqlite'),{readOnly:true});try{const entry=resolveHostingLink(restored,signHostingLink(link.id,secret),secret);assert.equal(await(await hostingDownload(restored,entry,new Request('https://example.com'),join(stage,'data/file-hosting'))).text(),'preserved binary content');}finally{restored.close();}
  }finally{source.close();await f.close();}
});
