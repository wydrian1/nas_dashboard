import {writeFileSync,mkdirSync,mkdtempSync,symlinkSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {encode} from 'next-auth/jwt';
import {load} from 'cheerio';
import assert from 'node:assert/strict';
import {initializeDatabase} from '../lib/db-schema.ts';

process.env.ALLOWED_EMAIL='owner@example.com';
mkdirSync(join(process.cwd(),'.runtime/research'),{recursive:true});
const root=process.cwd(),fixture=mkdtempSync(join(root,'.runtime/research/hosting-http-')),secret=randomBytes(32).toString('base64url'),port=3154,checks=[];
for(const [source,target]of [['.next-staging','.next'],['node_modules','node_modules'],['public','public']])symlinkSync(join(root,source),join(fixture,target),'junction');
writeFileSync(join(fixture,'package.json'),'{}');writeFileSync(join(fixture,'next.config.mjs'),'export default {distDir:".next"};');mkdirSync(join(fixture,'data'));
const db=new DatabaseSync(join(fixture,'data/dashboard.sqlite'));initializeDatabase(db);
for(const [email,role]of [['pokemon@example.com','pokemon-reader'],['info@example.com','info-reader']])db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,1,1)').run(email,role);
db.exec("INSERT INTO finance_accounts VALUES('fixture','Fixture','Test','asset',1,NULL);INSERT INTO finance_months(month,as_of,source,updated_at) VALUES('2026-09','2026-09-30','manual','2026-09-30');INSERT INTO finance_balances VALUES('2026-09','fixture',999900,0,NULL)");
const protectedTables=['dashboard_users','finance_months','finance_balances','finance_lego_items','finance_pokemon_items','mobile_devices','pokemon_shops','pokemon_products','monitors'];
const existing=protectedTables.filter(table=>db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)),before=Object.fromEntries(existing.map(table=>[table,JSON.stringify(db.prepare('SELECT * FROM '+table).all())])),cookies={};
for(const [role,email]of [['owner','owner@example.com'],['pokemon','pokemon@example.com'],['info','info@example.com']])cookies[role]='__Secure-authjs.session-token='+await encode({secret,salt:'__Secure-authjs.session-token',maxAge:3600,token:{email,name:'Synthetic '+role}});
const headers=(host='nas.wydrian.hu')=>({host,'x-forwarded-host':host,'x-forwarded-proto':'https'}),call=(path,role,options={},host='nas.wydrian.hu')=>fetch('http://127.0.0.1:'+port+path,{redirect:'manual',signal:AbortSignal.timeout(45000),...options,headers:{...headers(host),...(role?{cookie:cookies[role]}:{}),...options.headers}});
const json=(path,role,body,method='POST',host='nas.wydrian.hu')=>call(path,role,{method,headers:{origin:'https://'+host,'Content-Type':'application/json'},body:JSON.stringify(body)},host),check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const upload=(name,parent,body,role='owner',host='nas.wydrian.hu')=>call('/api/files/upload?'+new URLSearchParams({name,...(parent?{folder:parent}:{})}),role,{method:'POST',headers:{origin:'https://'+host,'Content-Type':'application/octet-stream'},body,duplex:'half'},host);
let child;
async function start(){child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,env:{...process.env,ALLOWED_EMAIL:'owner@example.com',AUTH_SECRET:secret,AUTH_URL:'',NEXTAUTH_URL:'',AUTH_MULTI_DOMAIN:'true',AUTH_GOOGLE_ID:'synthetic-client.apps.googleusercontent.com',AUTH_GOOGLE_SECRET:'synthetic-not-real',AUTH_TRUST_HOST:'true',FINANCE_ETORO_ENABLED:'false',FINANCE_EXTERNAL_FETCH_ENABLED:'false',POKEMON_PUSH_ENABLED:'false',OPENCODE_WEB_ENABLED:'false',ADMIN_HELPER_ENABLED:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs+=data;writeFileSync(join(fixture,'server.log'),logs);});for(let i=0;i<150;i++){try{const response=await call('/files');if(response.status===307){await response.body.cancel();return;}}catch{}if(child.exitCode!==null)throw new Error('Isolated server exited');await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Isolated server did not start');}
async function stop(){if(!child)return;const stopped=new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));child.kill();await stopped;child=null;}
async function declaredTooLarge(){return await new Promise((resolve,reject)=>{const request=httpRequest({host:'127.0.0.1',port,path:'/api/files/upload?name=declared-large',method:'POST',headers:{...headers(),cookie:cookies.owner,origin:'https://nas.wydrian.hu','content-length':'1000000001','content-type':'application/octet-stream'}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));});request.on('error',reject);request.end('small');});}
try{
  await start();check('isolated staging server starts with dual-domain authentication',true);
  for(const host of ['nas.wydrian.hu','wydrian.hu']){
    for(const [role,destination]of [[null,'/'],['pokemon','/pokemon'],['info','/important-info']]){const response=await call('/files',role,{},host);check(host+' '+(role||'anonymous')+' hosting page denied',response.status===307&&response.headers.get('location')===destination);await response.body.cancel();}
    const response=await call('/files','owner',{},host),page=load(await response.text());check(host+' admin hosting page/upload controls/active navigation',response.status===200&&page('nav a[href="/files"]').attr('aria-current')==='page'&&page('input[type="file"][multiple]').length===1);
  }
  for(const [role,status]of [[null,401],['pokemon',403],['info',403]]){
    for(const [path,options]of [['/api/files',{}],['/api/files/folders',{method:'POST',body:'{}'}],['/api/files/upload?name=forged',{method:'POST',body:'forged'}],['/api/files/links',{method:'POST',body:'{}'}],['/api/files/links',{method:'DELETE',body:'{}'}],['/api/files/'+('a'.repeat(32))+'/download',{}]]){const response=await call(path,role,options);check((role||'anonymous')+' '+path.split('?')[0]+' access denied',response.status===status);await response.body.cancel();}
  }
  check('reader/anonymous writes leave storage and share rows untouched',db.prepare('SELECT count(*) n FROM hosted_entries').get().n===0&&db.prepare('SELECT count(*) n FROM hosted_links').get().n===0);
  let response=await json('/api/files/folders','owner',{parent:null,name:'Documents'}),folder=await response.json();check('admin creates physical dedicated hosting folder',response.status===201&&readdirSync(join(fixture,'data/file-hosting')).includes(folder.id));
  response=await json('/api/files/folders','owner',{parent:null,name:'DOCUMENTS'});check('case-insensitive duplicate names cannot overwrite',response.status===409);await response.body.cancel();
  response=await call('/api/files/folders','owner',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({parent:null,name:'CSRF'})});check('cross-origin authenticated write rejected before mutation',response.status===403);await response.body.cancel();
  response=await json('/api/files/folders','owner',{parent:folder.id,name:'Nested'});const nested=await response.json();check('admin creates nested folder',response.status===201);
  const body='hello world\u0000 binary ő';response=await upload('Binary ő.html',nested.id,body);const file=await response.json();check('raw streaming upload ready only after exact size/hash and physical content',response.status===201&&file.size===Buffer.byteLength(body)&&file.sha256===createHash('sha256').update(body).digest('hex')&&readFileSync(join(fixture,'data/file-hosting',folder.id,nested.id,file.id+'.blob'),'utf8')===body);
  response=await upload('BINARY Ő.html',nested.id,'overwrite');check('upload cannot replace existing same-name file',response.status===409);await response.body.cancel();
  for(const name of ['../secret','.env.local','C:ads','CON.txt','bad\r\nname']){response=await upload(name,nested.id,'bad');check('unsafe name '+JSON.stringify(name)+' rejected',response.status===400);await response.body.cancel();}
  response=await call('/api/files?folder='+nested.id,'owner');const list=await response.json();check('admin private/no-store listing contains correct hierarchy and file only',response.status===200&&response.headers.get('cache-control')==='private, no-store'&&list.breadcrumbs.length===2&&list.entries.length===1&&list.entries[0].id===file.id&&list.maxFileBytes===1_000_000_000);
  response=await call('/api/files/'+file.id+'/download','owner');check('admin direct download does not require public link',response.status===200&&await response.text()===body);
  response=await json('/api/files/links','owner',{fileId:file.id,expiresAt:null});const permanent=await response.json(),sharePath=new URL(permanent.url).pathname;check('permanent signed file link created and no auth secret exposed',response.status===201&&permanent.expires_at===null&&permanent.url.startsWith('https://nas.wydrian.hu/s/')&&!permanent.url.includes(secret));
  response=await json('/api/files/links','owner',{fileId:folder.id,expiresAt:null});check('folder cannot be publicly shared or listed',response.status===400);await response.body.cancel();
  for(const host of ['nas.wydrian.hu','wydrian.hu']){
    response=await call(sharePath,null,{},host);check(host+' signed download is public and exact bytes',response.status===200&&await response.text()===body);for(const [header,expected]of [['content-type','application/octet-stream'],['x-content-type-options','nosniff'],['cache-control','private, no-store'],['referrer-policy','no-referrer']])check(host+' '+header+' '+response.headers.get(header),response.headers.get(header)===expected);check(host+' attachment response',response.headers.get('content-disposition').startsWith('attachment;'));check(host+' CSP sandbox '+response.headers.get('content-security-policy'),response.headers.get('content-security-policy').includes('sandbox'));
    response=await call(sharePath,null,{method:'HEAD'},host);check(host+' public HEAD no content',response.status===200&&response.headers.get('content-length')===String(Buffer.byteLength(body))&&(await response.text())==='');
    response=await call(sharePath,null,{headers:{range:'bytes=0-4'}},host);check(host+' public Range exact partial bytes',response.status===206&&response.headers.get('content-range')==='bytes 0-4/'+Buffer.byteLength(body)&&await response.text()==='hello');
  }
  response=await call(sharePath,null,{headers:{range:'bytes=999-1000'}});check('unsatisfiable range returns 416 without payload',response.status===416&&response.headers.get('content-range')==='bytes */'+Buffer.byteLength(body));await response.body.cancel();
  const changed=sharePath.slice(0,-1)+(sharePath.endsWith('A')?'B':'A');response=await call(changed,null);check('tampered signature uniform 404',response.status===404);await response.body.cancel();
  response=await call('/s/'+('a'.repeat(64))+'.'+('a'.repeat(43)),null);check('guessed token cannot reveal data',response.status===404);await response.body.cancel();
  response=await json('/api/files/links','owner',{fileId:file.id,expiresAt:Date.now()+3600000},'POST','wydrian.hu');const timed=await response.json(),timedPath=new URL(timed.url).pathname;check('expiring link respects requesting apex domain',response.status===201&&timed.url.startsWith('https://wydrian.hu/s/'));db.prepare('UPDATE hosted_links SET expires_at=? WHERE id=?').run(Date.now()-1,timed.id);response=await call(timedPath,null);check('expired valid signature rejected without user account',response.status===404);await response.body.cancel();
  response=await json('/api/files/links','owner',{fileId:file.id,expiresAt:Date.now()-1});check('past expiry cannot be created',response.status===400);await response.body.cancel();
  check('declared >1GB rejected before any disk write',await declaredTooLarge()===413);
  const chunk=Buffer.alloc(64*1024,0x61),largeHash=createHash('sha256');for(let i=0;i<192;i++)largeHash.update(chunk);
  let sent=0;const largeStream=new ReadableStream({pull(controller){if(sent++<192)controller.enqueue(chunk);else controller.close();}});response=await upload('12MiB.bin',nested.id,largeStream);const large=await response.json();check('chunked 12MiB upload bypasses small form limits with bounded stream and correct digest',response.status===201&&large.size===12*1024*1024&&large.sha256===largeHash.digest('hex'));
  response=await upload('empty.bin',nested.id,new Blob([]));const empty=await response.json();check('zero-byte HTTP upload supported',response.status===201&&empty.size===0);
  response=await call('/s',null);check('no public share root listing',response.status===404);await response.body.cancel();
  await stop();await start();response=await call(sharePath,null);check('permanent links and bytes survive server restart',response.status===200&&await response.text()===body);
  response=await json('/api/files/links','owner',{id:permanent.id},'DELETE');check('admin revokes permanent link',response.status===200);await response.body.cancel();response=await call(sharePath,null);check('revoked valid signature stops fresh public download',response.status===404);await response.body.cancel();
  check('hosting schema/audit leaves existing finance/roles/devices/monitor data unchanged',existing.every(table=>before[table]===JSON.stringify(db.prepare('SELECT * FROM '+table).all())));
  check('no finance audit or release/task push side effects',db.prepare('SELECT count(*) n FROM finance_audit').get().n===0&&db.prepare('SELECT count(*) n FROM mobile_push_outbox').get().n===0);
  check('hosting data SQLite integrity and FK checks pass',db.prepare('PRAGMA integrity_check').get().integrity_check==='ok'&&db.prepare('PRAGMA foreign_key_check').all().length===0);
  writeFileSync(join(root,'.runtime/research/hosting-http-verified.json'),JSON.stringify({passed:true,syntheticOnly:true,checks},null,2));console.log(JSON.stringify({passed:true,syntheticOnly:true,checks:checks.length}));
}finally{await stop();db.close();}
