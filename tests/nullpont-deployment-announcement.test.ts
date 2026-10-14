import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {initializeDatabase} from '../lib/db-schema.ts';
import {ownerEmail} from '../lib/users.ts';
import {sendNextPush} from '../lib/mobile/push.ts';
import {NULLPONT_PUBLIC_URL,nullpontInstalledDirectory,sha256,verifyNullpontDeployment,queueNullpontDeployment} from '../lib/deployment/nullpont-announcement.ts';

// Node's test runner isolates files: never use an actual account in these fixtures.
process.env.ALLOWED_EMAIL='owner@example.test';
const now=1_800_000_000_000,commit='b'.repeat(40);
function packageFixture(){
  const root=mkdtempSync(join(tmpdir(),'nullpont-announcement-synthetic-'));
  const artifacts={'package.json':JSON.stringify({version:'1.2.3'}),'.next/BUILD_ID':'synthetic-build','.next/required-server-files.json':'{}','lib/synthetic.ts':'export const synthetic=true;'};
  for(const [path,text]of Object.entries(artifacts)){mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),text);}
  const manifest=JSON.stringify({application:'nullpont',version:'1.2.3',checks:{tests:true,typecheck:true,build:true,browser:true},files:Object.entries(artifacts).map(([path,text])=>({path,size:Buffer.byteLength(text),sha256:sha256(text)}))});
  writeFileSync(join(root,'release-manifest.json'),manifest);
  const evidence={schemaVersion:1,application:'nullpont',state:'succeeded',phase:'complete',errorCode:0,url:NULLPONT_PUBLIC_URL,commit,manifestSha256:sha256(manifest),releaseDirectory:root,completedAt:now,buildId:'synthetic-build',checks:Object.fromEntries(['approved','storyApproved','sourceCommitVerified','packageVerified','backupVerified','serviceTargetVerified','localHealth','publicHealth','dataPreserved','rollbackNotNeeded'].map(name=>[name,true]))};
  const text=JSON.stringify(evidence),pins={evidenceSha256:sha256(text),commit,manifestSha256:sha256(manifest),releaseDirectory:root};
  return {root,evidence,text,pins,clean:()=>rmSync(root,{recursive:true,force:true})};
}
function database(){const db=new DatabaseSync(':memory:');initializeDatabase(db);for(const [i,email,role,active]of [['admin','admin@example.test','admin',1],['reader','reader@example.test','pokemon-reader',1],['info','info@example.test','info-reader',1],['inactive','inactive@example.test','admin',0],['owner',ownerEmail(),'admin',0]]as const){db.prepare('INSERT INTO dashboard_users(email,role,active,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET active=excluded.active').run(email,role,active,0,0);db.prepare('INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES(?,?,?,?,?,?,?,?,?)').run(i,'Synthetic',email,i,0,now+60*60_000,0,1,'synthetic-'+i);}return db;}
const release={commit,manifestSha256:'a'.repeat(64),version:'1.2.3'};
test('CLI installed-root policy allows only exact independent D:/!nullpont, never NAS runtime or sibling paths',()=>{
  assert.equal(nullpontInstalledDirectory('D:/!nullpont'),'D:\\!nullpont');
  assert.equal(nullpontInstalledDirectory('D:\\!nullpont'),'D:\\!nullpont');
  for(const path of ['D:/!nas/.runtime/release','D:/!nullpont-other','D:/!nullpont/child','D:/!nullpont/','D:/!nullpont/../!nullpont','D:/other/../!nullpont','C:/!nullpont','D:!nullpont','!nullpont','d:/!nullpont','\\\\?\\D:\\!nullpont','D:/!nullpont:stream',null])assert.throws(()=>nullpontInstalledDirectory(path));
  // Read source only: never import/execute the CLI against the live installation/database.
  const source=readFileSync(new URL('../scripts/Announce-Nullpont-Deployment.mjs',import.meta.url),'utf8');
  assert.match(source,/releaseDirectory=nullpontInstalledDirectory\(args\[9\]\)/);
  assert.match(source,/privatePath\(evidence\)/);
  assert.doesNotMatch(source,/privatePath\(releaseDirectory\)/);
  assert.ok(source.indexOf('nullpontInstalledDirectory(args[9])')<source.indexOf('new DatabaseSync('));
  assert.match(source,/realpathSync\(releaseDirectory\)!==releaseDirectory/);
});
test('NULLPONT accepts only pinned completed fresh evidence and verifies installed package bytes',()=>{
  const f=packageFixture();try{assert.deepEqual(verifyNullpontDeployment(f.text,f.pins,now),{commit,manifestSha256:f.pins.manifestSha256,version:'1.2.3'});
    for(const changes of [{application:'dashboard'},{state:'rolled-back'},{state:'uncertain'},{phase:'health'},{errorCode:1},{commit:'c'.repeat(40)},{manifestSha256:'c'.repeat(64)},{url:NULLPONT_PUBLIC_URL+'?redirect=evil'},{releaseDirectory:join(f.root,'other')},{completedAt:now+1},{completedAt:now-16*60_000},{buildId:'wrong'},{checks:{...f.evidence.checks,storyApproved:false}},{checks:{...f.evidence.checks,publicHealth:false}}]){const text=JSON.stringify({...f.evidence,...changes});assert.throws(()=>verifyNullpontDeployment(text,{...f.pins,evidenceSha256:sha256(text)},now));}
    assert.throws(()=>verifyNullpontDeployment(f.text,{...f.pins,evidenceSha256:'0'.repeat(64)},now));writeFileSync(join(f.root,'lib/synthetic.ts'),'tampered');assert.throws(()=>verifyNullpontDeployment(f.text,f.pins,now));
  }finally{f.clean();}
});
test('NULLPONT fixed release queue excludes inactive owner/readers and disabled/revoked/expired/tokenless devices, deduplicates across retries',()=>{
  const db=database();try{for(const [field,value]of [['push_enabled',0],['revoked',1],['expires_at',now],['fcm_token',null]]as const){db.prepare('UPDATE mobile_devices SET '+field+'=? WHERE id=?').run(value,'admin');assert.throws(()=>queueNullpontDeployment(db,release,now));db.prepare('UPDATE mobile_devices SET push_enabled=1,revoked=0,expires_at=?,fcm_token=? WHERE id=?').run(now+60*60_000,'synthetic-admin','admin');}
    assert.equal(queueNullpontDeployment(db,release,now),1);assert.equal(queueNullpontDeployment(db,release,now),0);db.exec("UPDATE mobile_push_outbox SET state='uncertain'");assert.equal(queueNullpontDeployment(db,release,now),0);
    const rows=db.prepare('SELECT * FROM mobile_push_outbox').all();assert.equal(rows.length,1);assert.equal(rows[0].device_id,'admin');assert.equal(rows[0].event_id,null);const payload=JSON.parse(String(rows[0].payload));assert.equal(payload.kind,'release');assert.equal(payload.path,'/');assert.ok(payload.body.endsWith(NULLPONT_PUBLIC_URL));assert.ok(!payload.body.includes(release.commit));
  }finally{db.close();}
});
test('existing sender cancels NULLPONT on demotion/opt-out and uncertain outcomes are not retried',async()=>{
  for(const action of ['demote','optout','uncertain']){const db=database();try{queueNullpontDeployment(db,release,now);if(action==='demote')db.exec("UPDATE dashboard_users SET role='pokemon-reader' WHERE email='admin@example.test'");if(action==='optout')db.exec("UPDATE mobile_devices SET push_enabled=0 WHERE id='admin'");let calls=0;const deliver=async()=>{calls++;return {state:'uncertain' as const};};await sendNextPush(db,{configured:true,now,deliver});await sendNextPush(db,{configured:true,now:now+5*60_000,deliver});assert.equal(calls,action==='uncertain'?1:0);assert.equal(queueNullpontDeployment(db,release,now),0);}finally{db.close();}}
});
test('existing sender rechecks admin identity after its asynchronous authorization step',async()=>{
  const db=database();try{queueNullpontDeployment(db,release,now);let sent=false;await sendNextPush(db,{configured:true,now,deliver:async(_token,_payload,_ttl,authorized)=>{await Promise.resolve();db.exec("UPDATE dashboard_users SET active=0 WHERE email='admin@example.test'");if(!authorized!())return {state:'cancelled'};sent=true;return {state:'sent'};}});assert.equal(sent,false);}finally{db.close();}
});
test('queue transaction rolls back its release marker if the outbox cannot accept a job',()=>{
  const db=database();try{db.exec("CREATE TRIGGER synthetic_reject BEFORE INSERT ON mobile_push_outbox BEGIN SELECT RAISE(ABORT,'synthetic'); END");assert.throws(()=>queueNullpontDeployment(db,release,now));assert.equal(db.prepare('SELECT count(*) n FROM release_announcements').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM mobile_push_outbox').get()!.n,0);}finally{db.close();}
});
