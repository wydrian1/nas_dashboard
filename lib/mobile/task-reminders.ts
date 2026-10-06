import type {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {ownerEmail,requireAccess,normalizeEmail,roleFor} from '../users.ts';
import {InputError,inputText} from './task-inputs.ts';

export const TASK_ZONE='Europe/Budapest';
export function taskDate(value:unknown):string|null {
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new InputError('Érvényes határidőt adj meg (2000–2099).');
  return value;
}
export function budapestClock(now:number){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TASK_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),part=(name:string)=>parts.find(item=>item.type===name)!.value;
  return {day:part('year')+'-'+part('month')+'-'+part('day'),hour:Number(part('hour'))};
}
export function deadlineDays(due:string,day:string){return Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/86_400_000);}
export function initializeTaskReminders(db:DatabaseSync){
  db.exec('BEGIN IMMEDIATE');try{
    const columns=new Set(db.prepare('PRAGMA table_info(todos)').all().map(row=>row.name));
    // Legacy web rollback still inserts just text: preserve owner visibility for those new rows too.
    if(!columns.has('owner_email')){const owner=normalizeEmail(ownerEmail());db.exec("ALTER TABLE todos ADD COLUMN owner_email TEXT NOT NULL DEFAULT '"+owner.replace(/'/g,"''")+"'");}
    if(!columns.has('due_date'))db.exec('ALTER TABLE todos ADD COLUMN due_date TEXT');
    db.exec(`CREATE TABLE IF NOT EXISTS task_reminder_runs(day TEXT PRIMARY KEY,checked_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS task_reminder_deliveries(outbox_id TEXT PRIMARY KEY REFERENCES mobile_push_outbox(id) ON DELETE CASCADE,task_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,due_date TEXT NOT NULL,day TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS release_announcements(id TEXT PRIMARY KEY,commit_sha TEXT NOT NULL,version TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS task_deadlines ON todos(owner_email,done,due_date); COMMIT`);
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function saveTask(db:DatabaseSync,email:string,textInput:unknown,dueInput:unknown,id?:number){
  requireAccess(db,email,'admin');const owner=normalizeEmail(email),text=inputText(textInput,'Feladat',200),due=taskDate(dueInput);
  db.exec('BEGIN IMMEDIATE');try{
    if(id){if(!db.prepare("UPDATE todos SET text=?,due_date=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND owner_email=?").run(text,due,id,owner).changes)throw new InputError('A feladat nem található vagy nem a sajátod.');cancelTaskReminders(db,id);}
    else {if(Number(db.prepare('SELECT count(*) AS n FROM todos WHERE owner_email=?').get(owner)!.n)>=100)throw new InputError('Legfeljebb 100 saját feladat tárolható.');db.prepare('INSERT INTO todos(text,due_date,owner_email) VALUES(?,?,?)').run(text,due,owner);}
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function cancelTaskReminders(db:DatabaseSync,id:number){db.prepare("UPDATE mobile_push_outbox SET state='cancelled' WHERE state IN ('queued','retry') AND id IN (SELECT outbox_id FROM task_reminder_deliveries WHERE task_id=?)").run(id);}
export function changeTask(db:DatabaseSync,email:string,id:number,remove=false){
  requireAccess(db,email,'admin');db.exec('BEGIN IMMEDIATE');try{
    if(!db.prepare('SELECT id FROM todos WHERE id=? AND owner_email=?').get(id,normalizeEmail(email)))throw new InputError('A feladat nem található vagy nem a sajátod.');
    cancelTaskReminders(db,id);db.prepare(remove?'DELETE FROM todos WHERE id=?':"UPDATE todos SET done=1-done,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(id);db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function checkTaskDeadlines(db:DatabaseSync,now=Date.now()){
  const clock=budapestClock(now);if(clock.hour<10)return 0;
  db.exec('BEGIN IMMEDIATE');try{
    if(!db.prepare('INSERT OR IGNORE INTO task_reminder_runs(day,checked_at) VALUES(?,?)').run(clock.day,now).changes){db.exec('COMMIT');return 0;}
    let queued=0;const tasks=db.prepare('SELECT id,text,owner_email,due_date FROM todos WHERE done=0 AND due_date IS NOT NULL').all() as {id:number;text:string;owner_email:string;due_date:string}[];
    for(const task of tasks){if(roleFor(db,task.owner_email)!=='admin')continue;const days=deadlineDays(task.due_date,clock.day);if(!Number.isFinite(days)||(days!==2&&days!==1&&days>=0))continue;
      const eventId='task-'+createHash('sha256').update(task.id+'|'+task.due_date+'|'+clock.day).digest('hex').slice(0,40),payload=JSON.stringify({kind:'task',eventId,title:days<0?'Lejárt feladat':days===1?'Holnap esedékes feladat':'2 nap múlva esedékes feladat',body:task.text+' · Határidő: '+task.due_date,path:'/notes#task-'+task.id});
      const devices=db.prepare('SELECT id FROM mobile_devices WHERE email=? AND revoked=0 AND push_enabled=1 AND fcm_token IS NOT NULL AND expires_at>?').all(task.owner_email,now) as {id:string}[];
      for(const device of devices){const id=eventId+'-'+device.id;queued+=Number(db.prepare('INSERT OR IGNORE INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES(?,?,?,?,?)').run(id,device.id,payload,now,now+15*60_000).changes);db.prepare('INSERT OR IGNORE INTO task_reminder_deliveries(outbox_id,task_id,due_date,day) VALUES(?,?,?,?)').run(id,task.id,task.due_date,clock.day);}
    }
    db.exec('COMMIT');return queued;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function taskPushAllowed(db:DatabaseSync,outboxId:string,email:string,now=Date.now()){
  const row=db.prepare('SELECT t.owner_email,t.done,t.due_date,d.due_date AS queued_due,d.day FROM task_reminder_deliveries d JOIN todos t ON t.id=d.task_id WHERE d.outbox_id=?').get(outboxId) as {owner_email:string;done:number;due_date:string;queued_due:string;day:string}|undefined;
  return !!row&&!row.done&&row.owner_email===email&&roleFor(db,email)==='admin'&&row.due_date===row.queued_due&&row.day===budapestClock(now).day;
}
export function queueReleaseAnnouncement(db:DatabaseSync,id:string,commit:string,version:string,now=Date.now()){
  if(!/^[a-f0-9]{32}$/.test(id)||! /^[a-f0-9]{40}$/.test(commit)||!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid successful release');
  db.exec('BEGIN IMMEDIATE');try{
    if(!db.prepare('INSERT OR IGNORE INTO release_announcements VALUES(?,?,?,?)').run(id,commit,version,now).changes){db.exec('COMMIT');return 0;}
    let count=0;for(const device of db.prepare('SELECT id,email FROM mobile_devices WHERE revoked=0 AND push_enabled=1 AND fcm_token IS NOT NULL AND expires_at>?').all(now) as {id:string;email:string}[]){if(roleFor(db,device.email)!=='admin')continue;count+=Number(db.prepare('INSERT OR IGNORE INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES(?,?,?,?,?)').run('release-'+id+'-'+device.id,device.id,JSON.stringify({kind:'release',eventId:'release-'+id,title:'Új fejlesztés élesítve · v'+version,body:'A NAS új kiadása sikeresen élesítve. Verzió: '+version,path:'/'}),now,now+15*60_000).changes);}
    db.exec('COMMIT');return count;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
