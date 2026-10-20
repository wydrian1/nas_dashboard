import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {initializeDatabase} from '../lib/db-schema.ts';
import {ownerEmail,initializeUsers,setUserRole,requireAccess,roleFor,homeForRole,canAccess} from '../lib/users.ts';
import {sanitizeInfoHtml,infoLink,INFO_HTML_LIMIT} from '../lib/important-info/html.ts';
import {readImportantInfo,saveImportantInfo,readLatestInfoFinance} from '../lib/important-info/store.ts';
import {deviceBySecret,updateDevice,queueTestPush,digest} from '../lib/mobile/store.ts';
import {readPokemonSnapshot} from '../lib/pokemon/snapshot.ts';
import {saveNotifications,notificationAllowed} from '../lib/pokemon/notifications.ts';
import {sendNextPush} from '../lib/mobile/push.ts';
const owner=ownerEmail(),reader='info@example.com';
function fixture(){const db=new DatabaseSync(':memory:');initializeDatabase(db);setUserRole(db,owner,reader,'info-reader',true);setUserRole(db,owner,'pokemon@example.com','pokemon-reader',true);return db;}
test('important-info role has only this content page, never admin or Pokemon privileges; owner stays protected',()=>{
  const db=fixture();try{assert.equal(roleFor(db,reader),'info-reader');assert.equal(homeForRole('info-reader'),'/important-info');assert.equal(requireAccess(db,reader,'important-info'),'info-reader');assert.equal(requireAccess(db,owner,'important-info'),'admin');
    for(const feature of ['admin','pokemon'] as const)assert.throws(()=>requireAccess(db,reader,feature));assert.throws(()=>requireAccess(db,'pokemon@example.com','important-info'));assert.equal(canAccess('pokemon-reader','important-info'),false);
    assert.throws(()=>readImportantInfo(db,'unknown@example.com'));assert.throws(()=>readLatestInfoFinance(db,'pokemon@example.com'));assert.throws(()=>saveImportantInfo(db,reader,'<p>No</p>','0'));assert.throws(()=>readPokemonSnapshot(db,false,Date.now(),{email:reader,role:'info-reader'}));assert.throws(()=>saveNotifications(db,reader,'gamerunner',true));
    assert.throws(()=>setUserRole(db,reader,'other@example.com','admin',true));assert.throws(()=>setUserRole(db,owner,owner,'info-reader',true));
    setUserRole(db,owner,reader,'info-reader',false);assert.throws(()=>readImportantInfo(db,reader));
  }finally{db.close();}
});
test('legacy role CHECK migrates transactionally, preserving users/child preferences/audit and enabling foreign keys again',()=>{
  const db=new DatabaseSync(':memory:');try{
    db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE dashboard_users(email TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('admin','pokemon-reader')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE pokemon_shops(id TEXT PRIMARY KEY,notify_new INTEGER,notify_restock INTEGER,notify_preorder INTEGER);INSERT INTO pokemon_shops VALUES('gamerunner',1,0,1);
      INSERT INTO dashboard_users VALUES('legacy@example.com','pokemon-reader',0,12,34);
      CREATE TABLE pokemon_user_notifications(email TEXT NOT NULL REFERENCES dashboard_users(email),shop_id TEXT NOT NULL REFERENCES pokemon_shops(id),enabled INTEGER NOT NULL DEFAULT 1,notify_new INTEGER NOT NULL DEFAULT 1,notify_restock INTEGER NOT NULL DEFAULT 1,notify_preorder INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(email,shop_id));
      INSERT INTO pokemon_user_notifications VALUES('legacy@example.com','gamerunner',0,1,0,1);`);
    const before=db.prepare("SELECT * FROM dashboard_users WHERE email='legacy@example.com'").get(),prefs=db.prepare("SELECT * FROM pokemon_user_notifications WHERE email='legacy@example.com'").all();initializeUsers(db);initializeUsers(db);
    assert.deepEqual(db.prepare("SELECT * FROM dashboard_users WHERE email='legacy@example.com'").get(),before);assert.deepEqual(db.prepare("SELECT * FROM pokemon_user_notifications WHERE email='legacy@example.com'").all(),prefs);assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys,1);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
    db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,1,1)').run(reader,'info-reader');assert.equal(roleFor(db,reader),'info-reader');db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,1,1)').run('game@example.com','nullpont-player');assert.equal(roleFor(db,'game@example.com'),'nullpont-player');assert.throws(()=>db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,1,1)').run('bad@example.com','god'));
  }finally{db.close();}
});
test('rich HTML retains basic formatting and safe links, removes active/embedded content and all unwanted attributes',()=>{
  const html=sanitizeInfoHtml('<h2 onclick="evil()">Title</h2><p><strong>Bold</strong> <em>italic</em><u>line</u><br><a href="https://example.com/help?q=1&amp;x=2" style="x" onclick="x">Safe</a></p><ul><li>One</li></ul><blockquote>Quote</blockquote>');
  assert.match(html,/<h2>Title<\/h2>/);assert.match(html,/<strong>Bold<\/strong>/);assert.match(html,/rel="noopener noreferrer"/);assert.doesNotMatch(html,/onclick|style=/);assert.equal(sanitizeInfoHtml(html),html);
  for(const payload of ['<script>alert(1)</script>','<iframe src="https://evil.example"></iframe>','<svg><script>x</script></svg>','<math><mtext><img src=x onerror=x></mtext></math>','<img src="https://evil.example/pixel">','<form action="https://evil.example"><input name=secret></form>','<style>*{display:none}</style>'])assert.equal(sanitizeInfoHtml(payload),'');
  for(const href of ['javascript:alert(1)','data:text/html,evil','//evil.example','https://u:p@evil.example','http://example.com','https://example.com\n']){assert.equal(infoLink(href),null);assert.equal(sanitizeInfoHtml('<a href="'+href+'">Text</a>'),'Text');}
  assert.throws(()=>sanitizeInfoHtml('x'.repeat(INFO_HTML_LIMIT+1)));assert.throws(()=>sanitizeInfoHtml(null));assert.throws(()=>sanitizeInfoHtml('<div>'.repeat(100)+'x'+'</div>'.repeat(100)));assert.equal(sanitizeInfoHtml('&lt;script&gt;hello&lt;/script&gt;'),'&lt;script&gt;hello&lt;/script&gt;');
});
test('important-info saves are explicit, sanitized, audited and revision-protected; stale draft never overwrites latest text',()=>{
  const db=fixture();try{assert.deepEqual(readImportantInfo(db,reader),{html:'',revision:0,updated_at:null});assert.equal(saveImportantInfo(db,owner,'<p onclick=x>Hello <b>world</b></p>','0','2026-10-06T12:00:00Z'),1);assert.equal(readImportantInfo(db,reader).html,'<p>Hello <b>world</b></p>');
    assert.throws(()=>saveImportantInfo(db,owner,'Lost update','0'));assert.equal(readImportantInfo(db,owner).revision,1);assert.equal(db.prepare('SELECT count(*) n FROM important_info_audit').get()!.n,1);saveImportantInfo(db,owner,'','1');assert.equal(readImportantInfo(db,reader).html,'');initializeDatabase(db);assert.equal(readImportantInfo(db,reader).revision,2);assert.equal(db.prepare('SELECT count(*) n FROM important_info_audit').get()!.n,2);
  }finally{db.close();}
});
test('latest finance projects only newest saved month, totals integer minor units/groups/debts/zero/missing without changing history',()=>{
  const db=fixture();try{assert.equal(readLatestInfoFinance(db,reader),null);
    for(const [id,name,category,kind]of [['cash','Cash','Liquid','asset'],['stock','Stock','Investments','asset'],['debt','Child debt','DEBT','debt'],['missing','Unknown','Other','asset'],['zero','Zero','Liquid','asset']] as const)db.prepare('INSERT INTO finance_accounts(id,name,category,kind,sort_order) VALUES(?,?,?,?,?)').run(id,name,category,kind,1);
    db.exec("INSERT INTO finance_months(month,as_of,source,note,updated_at) VALUES('2026-08','2026-08-31','manual','Old private note','2099-01-01'),('2026-09','2026-09-30','manual','Do not share note','2026-10-01')");
    for(const [month,id,amount]of [['2026-08','cash',999999],['2026-09','cash',10001],['2026-09','stock',20002],['2026-09','debt',-3003],['2026-09','zero',0]] as const)db.prepare('INSERT INTO finance_balances(month,account_id,amount_minor,source_cell) VALUES(?,?,?,?)').run(month,id,amount,'PRIVATE source cell');
    const before=db.prepare('SELECT * FROM finance_balances ORDER BY month,account_id').all(),summary=readLatestInfoFinance(db,reader)!;assert.equal(summary.month,'2026-09');assert.equal(summary.netMinor,27000);assert.equal(summary.assetsMinor,30003);assert.equal(summary.debtMinor,-3003);assert.equal(summary.groups.find(g=>g.category==='Liquid')!.totalMinor,10001);assert.equal(summary.groups.flatMap(g=>g.items).find(i=>i.id==='zero')!.amountMinor,0);assert.equal(summary.groups.flatMap(g=>g.items).find(i=>i.id==='missing')!.amountMinor,null);assert.doesNotMatch(JSON.stringify(summary),/PRIVATE|private note|share note|2026-08|source_cell|revision|importInfo/);
    assert.deepEqual(db.prepare('SELECT * FROM finance_balances ORDER BY month,account_id').all(),before);db.exec("INSERT INTO finance_months(month,as_of,source,note,updated_at) VALUES('2026-10','2026-10-06','manual','','2026-10-06');INSERT INTO finance_balances(month,account_id,amount_minor) VALUES('2026-10','cash',40004)");assert.equal(readLatestInfoFinance(db,reader)!.netMinor,40004);assert.equal(db.prepare('SELECT count(*) n FROM finance_balances').get()!.n,6);
  }finally{db.close();}
});
test('demotion to info-reader cancels module pushes and prevents token registration, testing or later delivery while preserving app read access',async()=>{
  const db=fixture(),secret='a'.repeat(43),now=Date.now();try{
    setUserRole(db,owner,reader,'pokemon-reader',true);db.prepare('INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES(?,?,?,?,?,?,?,?,?)').run('phone','Phone',reader,digest(secret),now,now+86400000,now,1,'test-token-long-enough');
    db.prepare('INSERT INTO mobile_push_outbox(id,device_id,payload,created_at,expires_at) VALUES(?,?,?,?,?)').run('pending','phone','{}',now,now+10000);setUserRole(db,owner,reader,'info-reader',true);assert.equal(db.prepare("SELECT state FROM mobile_push_outbox WHERE id='pending'").get()!.state,'cancelled');
    const device=deviceBySecret(db,secret);updateDevice(db,device,'test-token-long-enough',true);const actual=deviceBySecret(db,secret);assert.equal(actual.fcm_token,null);assert.equal(actual.push_enabled,0);assert.throws(()=>queueTestPush(db,actual));assert.equal(notificationAllowed(db,reader,1),false);await sendNextPush(db,{configured:true,deliver:async()=>{throw new Error('Info reader must not receive module data');}});
    assert.equal(readImportantInfo(db,reader).revision,0);assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();}
});
test('important-info UI checks access before projection, exposes editor only to admins, and never loads external finance providers',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),page=source('app/important-info/page.tsx');assert.ok(page.indexOf('canAccess(session.role')<page.indexOf('const document='));assert.match(page,/session.role==='admin'\?<ImportantInfoEditor/);assert.doesNotMatch(page,/financeMarket|readFinanceSnapshot/);assert.match(source('app/important-info/actions.ts'),/await requireAdmin\(\)/);assert.match(source('app/important-info/editor.tsx'),/contentEditable/);assert.match(source('app/user-settings.tsx'),/value="info-reader"/);
});
test('editor keeps a conflicting local draft/revision; only its own successful save advances the draft version',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),editor=source('app/important-info/editor.tsx'),page=source('app/important-info/page.tsx');
  assert.doesNotMatch(page,/key=\{document\.revision\}/);assert.match(editor,/initialHtml=useRef\(initial\.html\)/);assert.match(editor,/value=\{revision\}/);assert.match(editor,/state\.savedRevision!==undefined\)setRevision\(state\.savedRevision\)/);assert.doesNotMatch(editor,/setRevision\(initial\.revision\)|setHtml\(initial\.html\)/);
});
