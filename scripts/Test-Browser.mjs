// Reproducible built-app checks using only a synthetic SQLite DB and loopback server.
import {mkdtempSync,mkdirSync,writeFileSync,cpSync,symlinkSync,unlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {encode} from 'next-auth/jwt';
import {initializeDatabase} from '../lib/db-schema.ts';
import {load} from 'cheerio';

const root=process.cwd(),fixture=mkdtempSync(join(process.platform==='win32'?join(tmpdir(),'opencode'):tmpdir(),'nas-browser-'));
const owner='owner@example.test',reader='reader@example.test',info='info@example.test',admin='admin@example.test',now=Date.now(),secret=randomBytes(32).toString('base64url');
process.env.ALLOWED_EMAIL=owner;
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin='http://127.0.0.1:'+port;
// Runtime route caches must never mutate the build that will be sealed/published.
cpSync(join(root,'.next-staging'),join(fixture,'.next'),{recursive:true,filter:path=>path!==join(root,'.next-staging','cache')&&path!==join(root,'.next-staging','server','route-cache')});
symlinkSync(join(root,'node_modules'),join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');
cpSync(join(root,'public'),join(fixture,'public'),{recursive:true});
writeFileSync(join(fixture,'package.json'),'{"type":"module"}');writeFileSync(join(fixture,'next.config.mjs'),'export default {distDir:".next"};');mkdirSync(join(fixture,'data'));
const db=new DatabaseSync(join(fixture,'data/dashboard.sqlite'));initializeDatabase(db);
for(const [email,role]of [[reader,'pokemon-reader'],[info,'info-reader'],[admin,'admin']])db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,?,?)').run(email,role,now,now);
db.prepare("INSERT INTO notes(title,content) VALUES('Lantern private note','Synthetic private content'),('Literal %_ note','Safe text')").run();
db.prepare('INSERT INTO important_info VALUES(1,?,1,?)').run('<p>Lantern reader notice</p>',new Date(now).toISOString());
db.prepare("INSERT INTO finance_lego_items VALUES('lego-fixture','12345','Lantern LEGO',3,5000,NULL,1,?,NULL)").run(new Date(now).toISOString());
// Populated snapshots exercise both SVG title renderers; an empty finance page cannot expose #418.
db.exec("INSERT INTO finance_accounts VALUES('fixture-bank','Fixture bank','Fixture assets','asset',1,NULL),('fixture-debt','Fixture debt','Fixture debt','debt',2,11)");
for(const [month,amount]of [['2025-09',80000],['2026-08',100000],['2026-09',130000]]){
  db.prepare("INSERT INTO finance_months(month,as_of,source,note,updated_at) VALUES(?,?,'manual','',?)").run(month,month+'-01',new Date(now).toISOString());
  db.prepare('INSERT INTO finance_balances(month,account_id,amount_minor) VALUES(?,?,?)').run(month,'fixture-bank',amount);
}
db.prepare('INSERT INTO finance_balances(month,account_id,amount_minor) VALUES(?,?,?)').run('2026-09','fixture-debt',-20000);
db.prepare('INSERT INTO finance_annual VALUES(?,?,?,NULL,?,NULL)').run('2026-09-01','2025-09-01',110000,.04);
db.prepare("INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,price_huf,availability,in_stock,first_seen,last_seen) VALUES('grandline','fixture','','Lantern English Booster Box','https://www.grandline.hu/product',5000,'in_stock',1,?,?)").run(now,now);
db.prepare("UPDATE pokemon_shops SET baseline_at=?,last_success=?,failure_count=1,status='protected',last_error='Synthetic access protection' WHERE id='grandline'").run(now,now);
db.prepare("INSERT INTO pokemon_worker VALUES(1,?,'running')").run(now);
db.prepare("INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES('fixture-device','Synthetic phone',?,'synthetic-secret-hash',?,?,?,1,'synthetic-fcm-token')").run(owner,now,now+86400000,now);
db.prepare("INSERT INTO mobile_push_outbox(id,device_id,payload,state,created_at,expires_at) VALUES('fixture-push','fixture-device','{}','sent',?,?)").run(now,now+10000);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
const child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,AUTH_SECRET:secret,AUTH_URL:origin,AUTH_MULTI_DOMAIN:'false',AUTH_TRUST_HOST:'true',ALLOWED_EMAIL:owner,FINANCE_ETORO_ENABLED:'false',FINANCE_EXTERNAL_FETCH_ENABLED:'false',SERVICE_PROBES_ENABLED:'false',ADMIN_HELPER_ENABLED:'false',OPENCODE_WEB_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}});
let log='',browser,checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;writeFileSync(join(fixture,'server.log'),log);});
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture startup timed out')),30000);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Fixture server exited'));});child.stdout.on('data',()=>{if(log.includes('Ready in')){clearTimeout(timer);resolve();}});});
  const cookies={};for(const [role,email]of Object.entries({owner,reader,info,admin}))cookies[role]='authjs.session-token='+await encode({secret,salt:'authjs.session-token',maxAge:900,token:{email,name:'Synthetic browser check'}});
  const call=(path,role)=>fetch(origin+path,{redirect:'manual',headers:role?{cookie:cookies[role]}:{},signal:AbortSignal.timeout(20000)});
  for(const path of ['/search','/system','/notifications']){const response=await call(path);check(response.status===307&&response.headers.get('location')==='/','anonymous denied '+path);await response.body?.cancel();}
  for(const role of [null,'reader','info','admin']){const response=await call('/api/operations',role);check(response.status===(role?403:401),'owner-only operations API '+role);await response.body?.cancel();}
  let response=await call('/api/operations','owner');check(response.status===200,'owner operations API');const health=await response.json();check(health.backup.state==='unknown','missing backup is unknown');check(health.shops.find(item=>item.id==='grandline').stale,'stale shop metadata');check(!JSON.stringify(health).includes('synthetic-fcm-token'),'no token exposure');
  response=await call('/timeline');check(response.status===404,'timeline remains off the NAS');await response.body?.cancel();
  for(const [role,path,destination]of [['reader','/system','/pokemon'],['info','/notifications','/important-info'],['admin','/system','/']]){response=await call(path,role);check(response.status===307&&response.headers.get('location')===destination,'role boundary '+role+' '+path);await response.body?.cancel();}
  for(const role of ['owner','admin']){response=await call('/notifications',role);check(response.status===307&&response.headers.get('location')==='/config#notifications','legacy notifications redirect '+role);await response.body?.cancel();}
  for(const [role,destination]of [['reader','/pokemon'],['info','/important-info']]){response=await call('/config',role);check(response.status===307&&response.headers.get('location')===destination,'configuration still admin-only '+role);await response.body?.cancel();}
  browser=await chromium.launch({headless:true});
  for(const role of ['owner','reader','info']){
    const context=await browser.newContext({viewport:{width:1440,height:900},extraHTTPHeaders:{cookie:cookies[role]}}),page=await context.newPage(),errors=[],requests=[];
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
    await page.goto(origin+'/search?q=lantern');check(await page.locator('h1').textContent()==='Keresés','search rendered '+role);
    const kinds=await page.locator('.search-result small').allTextContents();
    if(role==='owner'){check(kinds.includes('Jegyzet')&&kinds.includes('LEGO'),'admin private results');}else{check(kinds.length===1&&kinds[0]===(role==='reader'?'Készletfigyelő':'Fontos infók'),'search role isolation '+role);check(!await page.locator('.search-result').filter({hasText:'private note'}).count(),'private note hidden '+role);}
    for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'search no overflow '+role+' '+width);}
    if(role!=='info'){
      await page.goto(origin+'/pokemon');check(await page.locator('#shop-grandline').innerText().then(text=>text.includes('Elavult készletadat')&&text.includes('Hozzáférésvédelem')),'stale stock clearly labelled '+role);
      await page.goto(origin+(role==='owner'?'/config#notifications':'/notifications'));check(await page.locator('h1').textContent()===(role==='owner'?'Konfig':'Értesítési központ'),'personal notifications '+role);check(await page.locator('#notifications').count()===1,'notification section '+role);check(await page.locator('select[name=digest_minutes]').inputValue()==='0','immediate default preserved '+role);
      check(await page.locator('nav a[href="/notifications"]').count()===(role==='reader'?1:0),'standalone notification menu reader-only '+role);
      check(await page.locator('input[name=watchlist_only]').isChecked()===false,'watchlist opt-in default '+role);
      for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'notifications no overflow '+role+' '+width);}
      check(await page.locator('.section-order-controls:not([hidden])').count()===0,'order controls hidden by default '+role);
      const add=page.locator('form').filter({has:page.locator('input[name=query]')});await add.locator('input[name=query]').fill('English Box');await add.locator('button[type=submit],button:not([type])').click();await page.getByText('Saját beállítások mentve.',{exact:false}).first().waitFor();check(await page.locator('.tools-row').filter({hasText:'English Box'}).count()===1,'real server action creates own rule '+role);
      check((await page.locator('a[href="/system"]').count()>0)===(role==='owner'),'owner-only menu '+role);
    }
    if(role==='owner'){
      await page.goto(origin+'/system');check(await page.locator('h1').textContent()==='Rendszer állapota','system view');check(await page.getByText('Mentési bizonyíték nem elérhető',{exact:false}).count()>0,'unknown backup visible');
      const financeResponse=await page.goto(origin+'/finance'),serverPage=load(await financeResponse.text());
      check(await page.locator('[data-valuation=quality]').count()===0,'redundant inventory quality panels removed');
      check(await page.locator('[data-valuation=saved]').count()===2&&await page.locator('[data-valuation=market]').count()===2,'saved and market comparisons retained');
      check(await page.locator('.collection-growth-card').nth(1).innerText().then(text=>text.includes('1 vásárlási sor dátuma ismeretlen')),'unknown-date calculation disclosure retained');
      await page.locator('.section-order-toggle button:not([disabled])').waitFor();
      for(const [selector,count]of [['.finance-pie circle title',1],['.finance-real-chart rect title',3]]){
        const serverTitles=serverPage(selector).map((_,element)=>serverPage(element).text()).get();
        check(serverTitles.length===count&&serverTitles.every(text=>text.trim().length>0),'complete server-rendered SVG titles '+selector);
        check(JSON.stringify(await page.locator(selector).allTextContents())===JSON.stringify(serverTitles),'hydrated SVG titles match server '+selector);
      }
      for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'populated finance no overflow '+width);}
    }
    check(errors.length===0,'no browser errors '+role+': '+errors.join(', '));check(requests.every(url=>url.startsWith(origin+'/')||new URL(url).hostname==='fonts.googleapis.com'),'no new external/private service calls '+role);await context.close();
  }
  console.log(JSON.stringify({passed:true,checks,syntheticDatabase:true,noProductionDataOrServiceChanges:true,roleIsolation:true,realServerActions:true,viewports:[1440,390,320]}));
}finally{
  if(browser)await browser.close();child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));
  unlinkSync(join(fixture,'node_modules'));rmSync(fixture,{recursive:true,force:true});
}
