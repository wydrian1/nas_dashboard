import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp,writeFile,readFile,rm,mkdir,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { archiveName,ownedArchiveDate,encryptArchive,decryptArchive,fileHash,snapshotDatabase,prepareStage,verifyStage,verifyGoogleBackupConfig } from '../lib/backup.ts';
async function fixture(){return mkdtemp(join(tmpdir(),'wydrian-backup-test-'));}
test('cloud uploads require the dedicated client, exact limited Drive scope and an offline token in the correct section',()=>{
  const text='[nas-drive]\ntype = drive\nclient_id = own-client\nclient_secret = test-secret\nscope = drive.file\ntoken = {"refresh_token":"test-refresh"}\n';
  assert.doesNotThrow(()=>verifyGoogleBackupConfig(text,'own-client'));
  for(const bad of [text.replace('own-client','shared-client'),text.replace('drive.file','drive'),text.replace('drive.file','drive.file,drive'),text.replace('test-refresh',''),text.replace('[nas-drive]','[other]'),text+'scope = drive\n',text+'service_account_file = other.json\n',text+'[nas-drive]\n'])assert.throws(()=>verifyGoogleBackupConfig(bad,'own-client'));
});
test('encrypted backup round-trips with a portable key, hides plaintext and rejects wrong keys/ciphertext/header/tag tampering',async()=>{
  const root=await fixture();try{
    const source=join(root,'source'),encrypted=join(root,'encrypted'),key=randomBytes(32).toString('base64'),plain=Buffer.from('PRIVATE FINANCE, NOTES AND RECOVERY KEYS\n'.repeat(5000));await writeFile(source,plain);await encryptArchive(source,encrypted,key);
    const bytes=await readFile(encrypted);assert.equal(bytes.subarray(0,8).toString(),'WYDNAS01');assert.equal(bytes.includes(Buffer.from('PRIVATE FINANCE')),false);
    const restored=join(root,'restored');await decryptArchive(encrypted,restored,key);assert.deepEqual(await readFile(restored),plain);
    await assert.rejects(()=>decryptArchive(encrypted,join(root,'wrong-key'),randomBytes(32).toString('base64')));
    for(const offset of [0,8,30,bytes.length-1]){const changed=Buffer.from(bytes);changed[offset]^=1;const file=join(root,'tampered-'+offset);await writeFile(file,changed);await assert.rejects(()=>decryptArchive(file,join(root,'bad-'+offset),key));}
    assert.ok(!(await readdir(root)).some(name=>name.endsWith('.partial')));await assert.rejects(()=>encryptArchive(source,join(root,'invalid'),'bad'));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('retention recognizes only this installation exact timestamped backup names; never unrelated backups or path traversal',()=>{
  const id='a123456789ab',date=new Date('2026-10-03T03:00:00.123Z'),name=archiveName(id,date);assert.equal(ownedArchiveDate(name,id),date.getTime());
  for(const bad of [name+'.receipt.json','../'+name,name.replace(id,'b123456789ab'),'dashboard-old.sqlite',name.replace('20261003','20260230')])assert.equal(ownedArchiveDate(bad,id),null);
  assert.throws(()=>archiveName('../bad'));assert.equal(ownedArchiveDate(name,'../bad'),null);
});
test('encryption and restore never overwrite existing destinations or remove pre-existing partials',async()=>{
  const root=await fixture();try{
    const source=join(root,'source'),encrypted=join(root,'encrypted'),target=join(root,'target'),key=randomBytes(32).toString('base64');await writeFile(source,'private');await encryptArchive(source,encrypted,key);const original=await readFile(encrypted);
    await assert.rejects(()=>encryptArchive(source,encrypted,key));assert.deepEqual(await readFile(encrypted),original);
    await writeFile(target,'keep');await assert.rejects(()=>decryptArchive(encrypted,target,key));assert.equal(await readFile(target,'utf8'),'keep');
    await writeFile(target+'.partial','other run');await assert.rejects(()=>decryptArchive(encrypted,target,key));assert.equal(await readFile(target+'.partial','utf8'),'other run');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('SQLite online snapshot includes committed WAL data without stopping or changing the source database',async()=>{
  const root=await fixture(),source=join(root,'live.sqlite'),target=join(root,'snapshot.sqlite'),db=new DatabaseSync(source);try{
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE items(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO items VALUES(1,'committed');");await snapshotDatabase(source,target);
    db.exec("INSERT INTO items VALUES(2,'later');");const copied=new DatabaseSync(target,{readOnly:true});try{assert.equal(copied.prepare('SELECT count(*) AS n FROM items').get()!.n,1);assert.equal(copied.prepare('SELECT value FROM items').get()!.value,'committed');}finally{copied.close();}
    assert.equal(db.prepare('SELECT count(*) AS n FROM items').get()!.n,2);
  }finally{db.close();await rm(root,{recursive:true,force:true});}
});
test('restorable stage includes essential source/settings/keys/APK but excludes dependencies, live WAL, backup key and generated caches',async()=>{
  const root=await fixture(),project=join(root,'project'),stage=join(root,'stage');await mkdir(join(project,'data'),{recursive:true});const db=new DatabaseSync(join(project,'data/dashboard.sqlite'));db.exec('CREATE TABLE items(id INTEGER);INSERT INTO items VALUES(1);');db.close();
  try{
    for(const path of ['lib/app.ts','app/api/auth/[...nextauth]/route.ts','.env.local','.runtime/secrets/firebase.json','.runtime/android-signing/key.jks','.runtime/artifacts/app.apk','data/caddy/certificate.key','node_modules/skip.js','.next/skip.js','.runtime/backup-secrets/recovery-key.json','android/app/build/skip.apk','android/app/src/Main.java']){await mkdir(join(project,path,'..'),{recursive:true});await writeFile(join(project,path),path);}
    const manifest=await prepareStage(project,stage);await verifyStage(stage);const names=manifest.files.map(file=>file.path);
    for(const path of ['lib/app.ts','.env.local','.runtime/secrets/firebase.json','.runtime/android-signing/key.jks','.runtime/artifacts/app.apk','data/caddy/certificate.key','data/dashboard.sqlite','android/app/src/Main.java'])assert.ok(names.includes(path),path);
    assert.ok(names.every(path=>!path.includes('node_modules') && !path.includes('.next/') && !path.includes('backup-secrets') && !path.includes('/build/') && !path.endsWith('-wal')));
    await writeFile(join(stage,'.env.local'),'changed');await assert.rejects(()=>verifyStage(stage));assert.notEqual(await fileHash(join(project,'.env.local')),await fileHash(join(stage,'.env.local')));
  }finally{await rm(root,{recursive:true,force:true});}
});
