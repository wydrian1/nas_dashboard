import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeDatabase} from '../lib/db-schema.ts';
import {ownerEmail,setUserRole} from '../lib/users.ts';
import {initializeTaskReminders,taskDate,budapestClock,deadlineDays,saveTask,changeTask,checkTaskDeadlines,queueReleaseAnnouncement} from '../lib/mobile/task-reminders.ts';
import {sendNextPush} from '../lib/mobile/push.ts';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {announceDeployment} from '../lib/deployment/announcement.ts';
const at=(day:string,hour='08:00')=>Date.parse(day+'T'+hour+':00Z'); // summer Budapest 10:00
function fixture(){const db=new DatabaseSync(':memory:');initializeDatabase(db);setUserRole(db,ownerEmail(),'second@example.com','admin',true);setUserRole(db,ownerEmail(),'reader@example.com','pokemon-reader',true);for(const [i,email]of [ownerEmail(),'second@example.com','reader@example.com'].entries())db.prepare('INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES(?,?,?,?,?,?,?,?,?)').run('device'+i,'Phone',email,'hash'+i,0,at('2099-01-01'),0,1,'fcm'+i);return db;}
test('deadline dates validate real calendar days and Budapest winter/summer/DST dates',()=>{
  assert.equal(taskDate('2028-02-29'),'2028-02-29');assert.equal(taskDate(''),null);for(const value of ['2026-02-29','2026-02-30','2026-13-01','1999-12-31','2026-1-01',42])assert.throws(()=>taskDate(value));
  assert.deepEqual(budapestClock(at('2026-07-01')),{day:'2026-07-01',hour:10});assert.deepEqual(budapestClock(at('2026-12-01','09:00')),{day:'2026-12-01',hour:10});assert.equal(budapestClock(at('2026-10-25','09:00')).hour,10);assert.equal(deadlineDays('2026-10-26','2026-10-24'),2);
});
test('migration preserves legacy task fields/ids/completion, assigns owner once, and remains idempotent',()=>{
  const db=new DatabaseSync(':memory:');try{db.exec("CREATE TABLE todos(id INTEGER PRIMARY KEY,text TEXT,done INTEGER,created_at TEXT,updated_at TEXT);INSERT INTO todos VALUES(14,'Legacy',1,'first','last')");initializeTaskReminders(db);let row=db.prepare('SELECT * FROM todos').get()!;assert.equal(row.owner_email,ownerEmail());assert.equal(row.due_date,null);assert.equal(row.done,1);assert.equal(row.created_at,'first');db.prepare("UPDATE todos SET owner_email='second@example.com',due_date='2026-10-08'").run();initializeTaskReminders(db);row=db.prepare('SELECT * FROM todos').get()!;assert.equal(row.owner_email,'second@example.com');assert.equal(row.id,14);assert.equal(row.text,'Legacy');assert.equal(row.updated_at,'last');}finally{db.close();}
});
test('task creator is immutable, only owns CRUD, reader cannot create, per-user capacity',()=>{
  const db=fixture();try{saveTask(db,ownerEmail(),'Owner task','2026-10-08');const id=Number(db.prepare('SELECT id FROM todos').get()!.id);assert.throws(()=>saveTask(db,'second@example.com','Stolen','2026-10-09',id));assert.throws(()=>changeTask(db,'second@example.com',id));assert.throws(()=>changeTask(db,'reader@example.com',id,true));assert.throws(()=>saveTask(db,'reader@example.com','Reader task',null));saveTask(db,'second@example.com','Own task',null);saveTask(db,ownerEmail(),'Edited','2026-10-09',id);assert.equal(db.prepare('SELECT owner_email FROM todos WHERE id=?').get(id)!.owner_email,ownerEmail());}finally{db.close();}
});
test('daily 10:00 runs send -2/-1 and each overdue day, not due-day, complete or no-date tasks; once per day/device',()=>{
  const db=fixture();try{saveTask(db,ownerEmail(),'Due','2026-10-08');saveTask(db,'second@example.com','Second','2026-10-08');saveTask(db,ownerEmail(),'No date',null);saveTask(db,ownerEmail(),'Done','2026-10-08');changeTask(db,ownerEmail(),4);
    assert.equal(checkTaskDeadlines(db,at('2026-10-06','07:59')),0);assert.equal(db.prepare('SELECT count(*) AS n FROM task_reminder_runs').get()!.n,0);
    for(const [day,count]of [['2026-10-06',2],['2026-10-07',2],['2026-10-08',0],['2026-10-09',2],['2026-10-10',2]]as const){assert.equal(checkTaskDeadlines(db,at(day)),count);assert.equal(checkTaskDeadlines(db,at(day,'14:00')),0);}
    const rows=db.prepare('SELECT o.device_id,o.payload,t.owner_email,d.day FROM mobile_push_outbox o JOIN task_reminder_deliveries d ON d.outbox_id=o.id JOIN todos t ON t.id=d.task_id').all();assert.equal(rows.length,8);assert.ok(rows.every(row=>row.device_id!== 'device2'));assert.ok(rows.every(row=>row.owner_email===(row.device_id==='device0'?ownerEmail():'second@example.com')));
  }finally{db.close();}
});
test('downtime catch-up checks current day after 10, never invents past reminders, respects revoked/disabled/no-token devices',()=>{
  const db=fixture();try{saveTask(db,ownerEmail(),'Due','2026-10-08');db.exec("UPDATE mobile_devices SET revoked=1 WHERE id='device0'");assert.equal(checkTaskDeadlines(db,at('2026-10-06','18:00')),0);db.exec("UPDATE mobile_devices SET revoked=0,push_enabled=0 WHERE id='device0'");assert.equal(checkTaskDeadlines(db,at('2026-10-07')),0);db.exec("UPDATE mobile_devices SET push_enabled=1,fcm_token=NULL WHERE id='device0'");assert.equal(checkTaskDeadlines(db,at('2026-10-09')),0);db.exec("UPDATE mobile_devices SET fcm_token='valid' WHERE id='device0'");assert.equal(checkTaskDeadlines(db,at('2026-10-10','18:00')),1);assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,1);}finally{db.close();}
});
test('closure/date edits/deletion cancel queued reminders and sending rechecks task state, owner and current role',async()=>{
  for(const action of ['complete','edit','delete','demote']){const db=fixture();try{saveTask(db,'second@example.com','Due','2026-10-08');checkTaskDeadlines(db,at('2026-10-06'));if(action==='complete')changeTask(db,'second@example.com',1);if(action==='edit')saveTask(db,'second@example.com','Edited','2026-10-12',1);if(action==='delete')changeTask(db,'second@example.com',1,true);if(action==='demote')setUserRole(db,ownerEmail(),'second@example.com','pokemon-reader',true);let delivered=0;await sendNextPush(db,{configured:true,now:at('2026-10-06'),deliver:async()=>{delivered++;return{state:'sent'};}});assert.equal(delivered,0,action);}finally{db.close();}}
});
test('reminders deliver only to creator; successful release announcement is once per release and admin-only, demotion cancels it',async()=>{
  const db=fixture();try{saveTask(db,'second@example.com','Due','2026-10-08');checkTaskDeadlines(db,at('2026-10-06'));let tokens:string[]=[];await sendNextPush(db,{configured:true,now:at('2026-10-06'),deliver:async token=>{tokens.push(token);return{state:'sent'};}});assert.deepEqual(tokens,['fcm1']);assert.equal(queueReleaseAnnouncement(db,'a'.repeat(32),'b'.repeat(40),'1.1.0',at('2026-10-06')),2);assert.equal(queueReleaseAnnouncement(db,'a'.repeat(32),'b'.repeat(40),'1.1.0',at('2026-10-06')),0);setUserRole(db,ownerEmail(),'second@example.com','pokemon-reader',true);tokens=[];for(let i=0;i<3;i++)await sendNextPush(db,{configured:true,now:at('2026-10-06'),deliver:async token=>{tokens.push(token);return{state:'sent'};}});assert.deepEqual(tokens,['fcm0']);}finally{db.close();}
});
test('deadline tick is independent of scan and push network waits; visible web/native version and update gates exist',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');assert.match(source('scripts/Pokemon-Worker.ts'),/setInterval\(checkReminders,10_000\)/);assert.match(source('app/dashboard-sidebar.tsx'),/Web v\{WEB_VERSION\}/);assert.match(source('android/app/src/main/java/hu/wydrian/nas/MainActivity.java'),/NAS DASHBOARD · v/);assert.match(source('scripts/Request-Deployment.mjs'),/announceDeployment/);assert.match(source('android/app/src/main/java/hu/wydrian/nas/AppUpdater.java'),/signer\(candidate\), signer\(installed\)/);assert.match(source('android/app/src/main/java/hu/wydrian/nas/NasApi.java'),/setInstanceFollowRedirects\(false\)/);assert.match(source('android/app/src/main/AndroidManifest.xml'),/REQUEST_INSTALL_PACKAGES/);
});
test('release announcements reject forged/mismatched/failed/rollback/uncertain/incomplete receipts, authenticated success is once',()=>{
  const db=fixture(),key=Buffer.alloc(32,7).toString('base64'),prepared={id:'c'.repeat(32),commit:'d'.repeat(40)};
  const receipt=(changes:Record<string,unknown>={})=>{const payload=JSON.stringify({...prepared,state:'succeeded',phase:'complete',errorCode:0,at:Date.now(),...changes});return JSON.stringify({payload,signature:createHmac('sha256',Buffer.from(key,'base64')).update('result\n'+payload).digest('hex')});};
  try{for(const state of ['accepted','running','rolled-back','failed','uncertain'])assert.equal(announceDeployment(db,receipt({state}),key,prepared,'1.1.0'),0);
    assert.equal(announceDeployment(db,receipt({phase:'health'}),key,prepared,'1.1.0'),0);assert.equal(announceDeployment(db,receipt({errorCode:1}),key,prepared,'1.1.0'),0);
    assert.throws(()=>announceDeployment(db,receipt({id:'e'.repeat(32)}),key,prepared,'1.1.0'));assert.throws(()=>announceDeployment(db,receipt({commit:'e'.repeat(40)}),key,prepared,'1.1.0'));assert.throws(()=>announceDeployment(db,receipt(),Buffer.alloc(32,9).toString('base64'),prepared,'1.1.0'));
    assert.equal(db.prepare('SELECT count(*) AS n FROM release_announcements').get()!.n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM mobile_push_outbox').get()!.n,0);
    assert.equal(announceDeployment(db,receipt(),key,prepared,'1.1.0'),2);assert.equal(announceDeployment(db,receipt(),key,prepared,'1.1.0'),0);
  }finally{db.close();}
});
test('authorization is rechecked after awaited FCM authentication and before dispatch',async()=>{
  for(const action of ['complete','edit','delete','revoke','token','demote']){const db=fixture();try{saveTask(db,'second@example.com','Due','2026-10-08');checkTaskDeadlines(db,at('2026-10-06'));let dispatched=false;
    await sendNextPush(db,{configured:true,now:at('2026-10-06'),deliver:async(_token,_payload,_ttl,authorized)=>{await Promise.resolve();if(action==='complete')changeTask(db,'second@example.com',1);if(action==='edit')saveTask(db,'second@example.com','Edited','2026-10-09',1);if(action==='delete')changeTask(db,'second@example.com',1,true);if(action==='revoke')db.exec("UPDATE mobile_devices SET revoked=1 WHERE id='device1'");if(action==='token')db.exec("UPDATE mobile_devices SET fcm_token='replacement' WHERE id='device1'");if(action==='demote')setUserRole(db,ownerEmail(),'second@example.com','pokemon-reader',true);if(!authorized!())return {state:'cancelled'};dispatched=true;return {state:'sent'};}});assert.equal(dispatched,false,action);
  }finally{db.close();}}
});
test('multiple creator devices get one delivery each; winter 10:00 and next local day remain correct',()=>{
  const db=fixture();try{db.prepare('INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES(?,?,?,?,?,?,?,?,?)').run('extra','Second phone',ownerEmail(),'extra-hash',0,at('2099-01-01'),0,1,'extra-token');saveTask(db,ownerEmail(),'Winter','2026-12-03');assert.equal(checkTaskDeadlines(db,at('2026-12-01','08:59')),0);assert.equal(checkTaskDeadlines(db,at('2026-12-01','09:00')),2);assert.equal(checkTaskDeadlines(db,at('2026-12-01','22:59')),0);assert.equal(checkTaskDeadlines(db,at('2026-12-02','09:00')),2);}finally{db.close();}
});
