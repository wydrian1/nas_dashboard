// Reproducible built-app checks using only a synthetic SQLite DB and loopback server.
import {mkdtempSync,mkdirSync,writeFileSync,cpSync,symlinkSync,unlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {encode} from 'next-auth/jwt';
import {initializeDatabase} from '../lib/db-schema.ts';
import {load} from 'cheerio';
import {alzaImageUrl} from '../lib/pokemon/adapters/alza.ts';
import {WEB_VERSION} from '../lib/mobile/release.ts';

const root=process.cwd(),fixture=mkdtempSync(join(process.platform==='win32'?join(tmpdir(),'opencode'):tmpdir(),'nas-browser-'));
const owner='owner@example.test',reader='reader@example.test',info='info@example.test',admin='admin@example.test',now=Date.now(),secret=randomBytes(32).toString('base64url');
process.env.ALLOWED_EMAIL=owner;
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin='http://127.0.0.1:'+port;
const bridgeSecret=randomBytes(32).toString('base64url'),gameOrigin='https://game.example.test';
// Runtime route caches must never mutate the build that will be sealed/published.
cpSync(join(root,'.next-staging'),join(fixture,'.next'),{recursive:true,filter:path=>path!==join(root,'.next-staging','cache')&&path!==join(root,'.next-staging','server','route-cache')});
symlinkSync(join(root,'node_modules'),join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');
cpSync(join(root,'public'),join(fixture,'public'),{recursive:true});
writeFileSync(join(fixture,'package.json'),'{"type":"module"}');writeFileSync(join(fixture,'next.config.mjs'),'export default {distDir:".next"};');mkdirSync(join(fixture,'data'));
// Dashboard SSR uses Node request(), not browser fetch: isolate fixed NAS probes too.
writeFileSync(join(fixture,'block-service-probes.mjs'),`import http from 'node:http';import https from 'node:https';import {EventEmitter} from 'node:events';import {syncBuiltinESMExports} from 'node:module';
for(const module of [http,https]){const request=module.request;module.request=function(target,...args){if(target instanceof URL&&target.hostname==='127.0.0.1'&&['8081','32400','8920'].includes(target.port)){const req=new EventEmitter();req.end=()=>queueMicrotask(()=>req.emit('error',new Error('Synthetic fixture blocks NAS probes')));return req;}return request.call(this,target,...args);};}syncBuiltinESMExports();
// Emulate Caddy's HTTPS origin only for explicitly marked same-origin fixture calls.
// Chromium preserves the actual loopback Origin even when route headers override it.
const emit=http.Server.prototype.emit;http.Server.prototype.emit=function(event,...args){const request=args[0];if(event==='request'&&request.url?.split('?')[0].startsWith('/api/files')&&request.headers['x-nas-browser-fixture']==='files-proxy'&&request.headers.host===${JSON.stringify(new URL(origin).host)}&&request.headers.origin===${JSON.stringify(origin)}&&request.headers['sec-fetch-site']==='same-origin'){request.headers.origin='https://nas.wydrian.hu';for(let index=0;index<request.rawHeaders.length;index+=2)if(request.rawHeaders[index].toLowerCase()==='origin')request.rawHeaders[index+1]='https://nas.wydrian.hu';}return emit.call(this,event,...args);};`);
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
const alzaImage=alzaImageUrl('https://image.alza.cz/products/DEMO/DEMO.jpg?width=190&height=190');
assert.equal(alzaImage,'https://image.alza.cz/products/DEMO/DEMO.jpg');
db.prepare("INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,image,price_huf,availability,in_stock,first_seen,last_seen) VALUES('alza','1001','1001','Synthetic Alza Image','https://m.alza.hu/jatekok/pokemon-demo-d1001.htm',?,2290,'in_stock',1,?,?)").run(alzaImage,now,now);
db.prepare("INSERT INTO pokemon_worker VALUES(1,?,'running')").run(now);
db.prepare("INSERT INTO mobile_devices(id,label,email,secret_hash,created_at,expires_at,last_seen,push_enabled,fcm_token) VALUES('fixture-device','Synthetic phone',?,'synthetic-secret-hash',?,?,?,1,'synthetic-fcm-token')").run(owner,now,now+86400000,now);
db.prepare("INSERT INTO mobile_push_outbox(id,device_id,payload,state,created_at,expires_at) VALUES('fixture-push','fixture-device','{}','sent',?,?)").run(now,now+10000);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
const child=spawn(process.execPath,['--import',pathToFileURL(join(fixture,'block-service-probes.mjs')).href,join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,AUTH_SECRET:secret,AUTH_URL:origin,NULLPONT_URL:gameOrigin,NULLPONT_SSO_SECRET:bridgeSecret,AUTH_MULTI_DOMAIN:'false',AUTH_TRUST_HOST:'true',ALLOWED_EMAIL:owner,FINANCE_ETORO_ENABLED:'false',FINANCE_EXTERNAL_FETCH_ENABLED:'false',SERVICE_PROBES_ENABLED:'false',ADMIN_HELPER_ENABLED:'false',OPENCODE_WEB_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}});
let log='',browser,checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;writeFileSync(join(fixture,'server.log'),log);});
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture startup timed out')),30000);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Fixture server exited'));});child.stdout.on('data',()=>{if(log.includes('Ready in')){clearTimeout(timer);resolve();}});});
  const cookies={};for(const [role,email]of Object.entries({owner,reader,info,admin}))cookies[role]='authjs.session-token='+await encode({secret,salt:'authjs.session-token',maxAge:900,token:{email,name:'Synthetic browser check'}});
  const call=(path,role)=>fetch(origin+path,{redirect:'manual',headers:role?{cookie:cookies[role]}:{},signal:AbortSignal.timeout(20000)});
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  const authorization='/api/nullpont/authorize?state='+state+'&challenge='+challenge+'&redirect_uri=https://evil.example.test';
  const unauth=await call(authorization);check(unauth.status===303&&unauth.headers.get('location')==='/','anonymous handoff requires dashboard login');await unauth.body?.cancel();
  const redeem=async(code,key=bridgeSecret,proof=verifier)=>fetch(origin+'/api/nullpont/redeem',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({code,verifier:proof}),signal:AbortSignal.timeout(10000)});
  for(const role of ['owner','reader','info']){
    const response=await call(authorization,role),callback=new URL(response.headers.get('location'));await response.body?.cancel();
    check(response.status===303&&callback.origin===gameOrigin&&callback.pathname==='/api/sso/callback','fixed callback ignores arbitrary redirect '+role);
    check(callback.searchParams.get('state')===state&&!callback.href.includes('@'),'opaque browser handoff '+role);
    const code=callback.searchParams.get('code');let result=await redeem(code,'wrong-secret');check(result.status===401,'bridge rejects wrong key '+role);await result.body?.cancel();
    result=await redeem(code,bridgeSecret,'a'.repeat(43));check(result.status===401,'bridge rejects wrong PKCE '+role);await result.body?.cancel();
    result=await redeem(code);check(result.status===200&&(await result.json()).email===({owner,reader,info})[role],'existing dashboard identity transferred '+role);
    result=await redeem(code);check(result.status===401,'code cannot be replayed '+role);await result.body?.cancel();
  }
  const pending=await call(authorization,'reader'),pendingCode=new URL(pending.headers.get('location')).searchParams.get('code');await pending.body?.cancel();
  const membership=new DatabaseSync(join(fixture,'data/dashboard.sqlite'));membership.prepare('UPDATE dashboard_users SET active=0 WHERE email=?').run(reader);
  const denied=await redeem(pendingCode);check(denied.status===401,'dashboard membership rechecked at redemption');await denied.body?.cancel();membership.prepare('UPDATE dashboard_users SET active=1 WHERE email=?').run(reader);membership.close();
  for(const path of ['/search','/system','/notifications','/files','/adventure']){const response=await call(path);check(response.status===307&&response.headers.get('location')==='/','anonymous denied '+path);await response.body?.cancel();}
  for(const role of [null,'reader','info','admin']){const response=await call('/api/operations',role);check(response.status===(role?403:401),'owner-only operations API '+role);await response.body?.cancel();}
  let response=await call('/api/operations','owner');check(response.status===200,'owner operations API');const health=await response.json();check(health.backup.state==='unknown','missing backup is unknown');check(health.shops.find(item=>item.id==='grandline').stale,'stale shop metadata');check(!JSON.stringify(health).includes('synthetic-fcm-token'),'no token exposure');
  response=await call('/timeline');check(response.status===404,'timeline remains off the NAS');await response.body?.cancel();
  for(const [role,path,destination]of [['reader','/system','/pokemon'],['info','/notifications','/important-info'],['admin','/system','/']]){response=await call(path,role);check(response.status===307&&response.headers.get('location')===destination,'role boundary '+role+' '+path);await response.body?.cancel();}
  for(const role of ['owner','admin']){response=await call('/notifications',role);check(response.status===307&&response.headers.get('location')==='/config#notifications','legacy notifications redirect '+role);await response.body?.cancel();}
  for(const [role,destination]of [['reader','/pokemon'],['info','/important-info']]){response=await call('/config',role);check(response.status===307&&response.headers.get('location')===destination,'configuration still admin-only '+role);await response.body?.cancel();}
  for(const [role,destination]of [['reader','/pokemon'],['info','/important-info']]){response=await call('/files',role);check(response.status===307&&response.headers.get('location')===destination,'files remain admin-only '+role);await response.body?.cancel();}
  response=await fetch(origin+'/api/files/folders',{method:'POST',headers:{cookie:cookies.owner,origin,'Content-Type':'application/json'},body:JSON.stringify({parent:null,name:'Rejected loopback origin'})});check(response.status===403,'file writes still reject unsupported loopback origins');await response.body?.cancel();
  for(const role of ['owner','admin'])for(const [query,destination]of [['','/#dashboard-search'],['?q=lantern','/?q=lantern#dashboard-search'],['?q=%25_','/?q=%25_#dashboard-search'],['?q=one&q=two','/#dashboard-search']]){response=await call('/search'+query,role);check(response.status===307&&response.headers.get('location')===destination,'legacy search redirect '+role+' '+query);await response.body?.cancel();}
  for(const [role,destination]of [['reader','/pokemon'],['info','/important-info']]){response=await call('/?q=lantern',role);check(response.status===307&&response.headers.get('location')===destination,'dashboard remains admin-only '+role);await response.body?.cancel();}
  browser=await chromium.launch({headless:true});
  for(const role of ['owner','reader','info']){
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addCookies([{name:'authjs.session-token',value:cookies[role].slice('authjs.session-token='.length),url:origin}]);
    const page=await context.newPage(),errors=[],requests=[];
    await context.route('**/*',route=>{
      if(route.request().url()===alzaImage&&route.request().method()==='GET'&&route.request().resourceType()==='image')return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>'});
      const request=route.request();if(!request.url().startsWith(origin+'/'))return route.abort();
      // Fixture-only proxy headers: file APIs require the real HTTPS dashboard origin.
      // Traffic and storage stay in this loopback/temp fixture; never relax app policy.
      if(new URL(request.url()).pathname.startsWith('/api/files'))return route.continue({headers:{...request.headers(),'x-nas-browser-fixture':'files-proxy','x-forwarded-host':'nas.wydrian.hu','x-forwarded-proto':'https'}});
      return route.continue();
    });
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
    await page.goto(origin+'/search?q=lantern');const searchHeading=await page.locator('h1').textContent();check(searchHeading===(role==='owner'?'Dashboard':'Keresés'),'search rendered '+role+': '+searchHeading+' at '+page.url());
    check(await page.locator('nav a[href="/search"]').count()===0,'no standalone search menu '+role);
    check(await page.locator('.version-label').textContent()==='Web v'+WEB_VERSION,'web patch version displayed '+role);
    if(role==='owner')check(await page.locator('#dashboard-search').getAttribute('open')!==null,'query automatically opens search');
    const kinds=await page.locator('.search-result small').allTextContents();
    if(role==='owner'){check(kinds.includes('Jegyzet')&&kinds.includes('LEGO'),'admin private results');}else{check(kinds.length===1&&kinds[0]===(role==='reader'?'Készletfigyelő':'Fontos infók'),'search role isolation '+role);check(!await page.locator('.search-result').filter({hasText:'private note'}).count(),'private note hidden '+role);}
    for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'search no overflow '+role+' '+width);}
    if(role!=='info'){
      await page.goto(origin+'/pokemon');check(await page.locator('#shop-grandline').innerText().then(text=>text.includes('Elavult készletadat')&&text.includes('Hozzáférésvédelem')),'stale stock clearly labelled '+role);
      check(await page.locator('#shop-alza').count()===1,'Alza independently listed '+role);
      check(await page.locator('#shop-alza').innerText().then(text=>text.includes('Szünetel')),'Alza initially paused '+role);
      check(await page.locator('#shop-alza a[href="https://m.alza.hu/jatekok/pokemon-kartyak/18879069.htm?availabilityFilterValue=2"]').count()===1,'Alza uses reviewed mobile stock URL '+role);
      await page.locator('#shop-alza details.pokemon-products > summary').click();
      const image=page.locator('#shop-alza .pokemon-product img');check(await image.getAttribute('src')===alzaImage,'Alza normalized image reaches the product UI '+role);await image.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('#shop-alza .pokemon-product img')?.naturalWidth>0);check(await image.isVisible(),'Alza image renders using only synthetic image bytes '+role);
      await page.goto(origin+(role==='owner'?'/config#notifications':'/notifications'));check(await page.locator('h1').textContent()===(role==='owner'?'Konfig':'Értesítési központ'),'personal notifications '+role);check(await page.locator('#notifications').count()===1,'notification section '+role);check(await page.locator('select[name=digest_minutes]').inputValue()==='0','immediate default preserved '+role);
      check(await page.locator('nav a[href="/notifications"]').count()===(role==='reader'?1:0),'standalone notification menu reader-only '+role);
      check(await page.locator('input[name=watchlist_only]').isChecked()===false,'watchlist opt-in default '+role);
      for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'notifications no overflow '+role+' '+width);}
      check(await page.locator('.section-order-controls:not([hidden])').count()===0,'order controls hidden by default '+role);
      const add=page.locator('form').filter({has:page.locator('input[name=query]')});await add.locator('input[name=query]').fill('English Box');await add.locator('button[type=submit],button:not([type])').click();await page.getByText('Saját beállítások mentve.',{exact:false}).first().waitFor();check(await page.locator('.tools-row').filter({hasText:'English Box'}).count()===1,'real server action creates own rule '+role);
      check((await page.locator('a[href="/system"]').count()>0)===(role==='owner'),'owner-only menu '+role);
    }
    if(role==='owner'){
      await page.goto(origin+'/');await page.locator('.section-order-toggle button:not([disabled])').waitFor();
      check(await page.locator('#dashboard-search').getAttribute('open')===null,'dashboard search collapsed by default');
      check(!(await page.locator('#dashboard-search input').isVisible()),'collapsed search hides input');
      check(await page.locator('#dashboard-search').evaluate(element=>element.getBoundingClientRect().height<=56),'closed search is compact');
      check(await page.locator('.section-order-controls:not([hidden])').count()===0,'dashboard order controls still hidden');
      const summary=page.locator('#dashboard-search summary');await summary.focus();await page.keyboard.press('Enter');
      check(await page.locator('#dashboard-search input').isVisible(),'keyboard opens native disclosure');
      await page.locator('#dashboard-search input').fill('lantern');await page.locator('#dashboard-search button').click();await page.waitForURL(url=>url.searchParams.get('q')==='lantern');
      check(await page.locator('#dashboard-search[open] .search-result').count()>0,'GET search returns results in dashboard disclosure');
      await page.locator('#dashboard-search summary').click();check(!(await page.locator('#dashboard-search input').isVisible()),'search can collapse with results');
      for(const width of [1440,1024,390,320]){
        await page.setViewportSize({width,height:844});
        const geometry=await page.locator('.sidebar nav a').evaluateAll(links=>links.map(link=>{const icon=link.querySelector('.nav-icon').getBoundingClientRect(),text=link.querySelector('.nav-text').getBoundingClientRect();return {label:link.querySelector('.nav-text').textContent,iconX:icon.x,iconWidth:icon.width,textX:text.x,linkWidth:link.getBoundingClientRect().width,scrollWidth:link.scrollWidth};}));
        check(geometry.every(item=>Math.abs(item.iconWidth-(width>720?24:20))<.1),'fixed icon column '+width);
        const starts=[...new Set(geometry.map(item=>Math.round(item.textX*10)/10))];
        check(starts.length===(width>720?1:2),'labels start in aligned columns '+width);
        check(geometry.every(item=>item.scrollWidth<=Math.ceil(item.linkWidth)),'no clipped menu text '+width+': '+JSON.stringify(geometry.filter(item=>item.scrollWidth>Math.ceil(item.linkWidth))));
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'dashboard no overflow '+width);
      }
      const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});await noJS.addCookies([{name:'authjs.session-token',value:cookies.owner.slice('authjs.session-token='.length),url:origin}]);await noJS.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      const fallback=await noJS.newPage();await fallback.goto(origin+'/');await fallback.locator('#dashboard-search summary').click();await fallback.locator('#dashboard-search input').fill('lantern');
      await Promise.all([fallback.waitForURL(url=>url.searchParams.get('q')==='lantern'),fallback.locator('#dashboard-search button').click()]);
      check(await fallback.locator('#dashboard-search[open] .search-result').count()>0,'native dashboard search works without JavaScript');await noJS.close();
      await page.goto(origin+'/files');await page.locator('.section-order-toggle button:not([disabled])').waitFor();
      check(await page.locator('[data-section="upload"] .section-heading h2').textContent()==='Tároló','storage has a real shared panel heading');
      check(await page.locator('.files-breadcrumbs').count()===0,'root storage does not repeat its own title as a breadcrumb');
      check(await page.locator('.files-panel > .section-heading').count()===3,'all files panels use shared headings');
      check(await page.locator('[data-section="entries"] h2 span').textContent()==='0 bejegyzés','entries count is a separate badge');
      check(await page.locator('.section-order-controls:not([hidden])').count()===0,'files order controls remain hidden');
      const picker=page.locator('.files-file-picker input[type=file]'),longName='Hosszú_fájlnév_'.repeat(10)+'.txt';
      await picker.focus();check(await page.locator('.files-file-picker').evaluate(element=>getComputedStyle(element).outlineWidth==='2px'),'native file input retains visible keyboard focus');
      await picker.setInputFiles({name:longName,mimeType:'text/plain',buffer:Buffer.from('Synthetic file storage layout test')});
      check(await page.locator('.files-file-selection').textContent()===longName,'selected long filename stays available');
      for(const width of [1440,1101,1024,390,320]){
        await page.setViewportSize({width,height:844});
        const geometry=await page.locator('.files-tools').evaluate(element=>Array.from(element.querySelectorAll('form')).map(form=>{const rect=node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height};};const field=form.querySelector('.files-file-picker')||form.querySelector('input');return {form:rect(form),label:rect(form.querySelector('label')),field:rect(field),button:rect(form.querySelector('button')),margin:getComputedStyle(form.querySelector('input')).marginTop};})),[folder,upload]=geometry;
        check(geometry.every(item=>item.margin==='0px'&&Math.abs(item.field.height-44)<.1&&Math.abs(item.field.width-item.form.width)<.1),'equal full-width fields without inherited margin '+width);
        check(width>1100?Math.abs(folder.label.y-upload.label.y)<.1&&Math.abs(folder.field.y-upload.field.y)<.1&&Math.abs(folder.button.y-upload.button.y)<.1:Math.abs(folder.field.x-upload.field.x)<.1&&upload.form.y>=folder.form.y+folder.form.height+23,'aligned desktop or stacked storage forms '+width);
        check(geometry.every(item=>item.button.y>=item.field.y+item.field.height+11&&item.button.height>=44),'actions sit below fields with usable touch targets '+width);
        check(await page.locator('.files-panel-heading h2').first().evaluate(element=>getComputedStyle(element).fontSize)===(width<=720?'17px':'19px'),'shared panel title typography '+width);
        check(await page.locator('[data-section="entries"] .files-panel').evaluate(element=>Math.abs(element.getBoundingClientRect().y-document.querySelector('[data-section="upload"] .files-panel').getBoundingClientRect().bottom-24)<.1),'one section gap, no doubled panel margin '+width);
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'files long selection no page overflow '+width);
      }
      const folderName='Hosszú_mappanév_'.repeat(10);
      await page.locator('.files-tools form').first().locator('input').fill(folderName);const made=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/files/folders'&&response.request().method()==='POST');await page.getByRole('button',{name:'Mappa létrehozása',exact:true}).click();const madeResponse=await made;check(madeResponse.status()===201,'folder API success: '+await madeResponse.text());await page.getByText('Mappa létrehozva.',{exact:true}).waitFor();
      check(await page.locator('.files-table tbody tr').count()===1,'styled folder form still creates a real fixture folder');
      await Promise.all([page.waitForURL(url=>url.searchParams.has('folder')),page.locator('.files-table a').click()]);await page.locator('.section-order-toggle button:not([disabled])').waitFor();
      check(await page.locator('.files-breadcrumbs li').count()===2&&await page.locator('.files-breadcrumbs a[aria-current=page]').textContent()===folderName,'long folder breadcrumb remains navigable');
      check(await page.locator('[data-section="entries"] h2').textContent().then(text=>text.startsWith(folderName)),'folder title retained in shared heading');
      await picker.setInputFiles({name:longName,mimeType:'text/plain',buffer:Buffer.from('Synthetic file storage layout test')});
      const sent=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/files/upload'&&request.method()==='POST');await page.getByRole('button',{name:'Feltöltés',exact:true}).click();const uploadRequest=await sent;await page.getByText('1 fájl feltöltve.',{exact:true}).waitFor();
      check(uploadRequest.headers()['content-type']==='application/octet-stream'&&uploadRequest.postData()==='Synthetic file storage layout test','styled upload still streams raw fixture bytes');
      await page.locator('.files-table tbody tr').filter({hasText:longName}).waitFor(); // Upload success precedes the final listing refresh.
      check(await page.locator('.files-file-selection').textContent()==='Nincs kiválasztott fájl'&&await page.locator('.files-table tbody tr').count()===1,'successful upload clears selection and refreshes listing');
      await page.getByRole('button',{name:'Link létrehozása',exact:true}).click();
      check(await page.locator('[data-section="share"] .section-heading h2').textContent()==='Megosztás: '+longName,'share panel uses same heading and preserves filename');
      await page.locator('.files-share-form select').selectOption('custom');check(await page.locator('.files-share-form input[type=datetime-local][required]').count()===1,'custom link expiry control retained');
      for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'populated folder/share panel no overflow '+width);}
      await page.locator('.files-share-form select').selectOption('24');await page.getByRole('button',{name:'Megosztási link létrehozása',exact:true}).click();await page.getByText('Megosztási link létrehozva; lent másolható.',{exact:true}).waitFor();
      check(await page.locator('.files-link input[readonly]').inputValue().then(url=>url.startsWith('https://nas.wydrian.hu/s/'))&&await page.locator('[data-section="links"] h2 span').textContent()==='1','share form still creates a signed fixture link and updates badge');
      check(await page.locator('.section-order-controls:not([hidden])').count()===0,'files ordering stays opt-in after operations');
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
    const legacy=await call('/adventure',role);check(legacy.status===307&&legacy.headers.get('location')===gameOrigin+'/','legacy route redirects to standalone '+role);await legacy.body?.cancel();
    check(await page.locator('nav a[href="/adventure"]').count()===0,'no embedded game menu '+role);
    check(await page.locator('.game-grid,.adventure-layout').count()===0,'dashboard does not serve game UI '+role);
    check(errors.length===0,'no browser errors '+role+': '+errors.join(', '));check(requests.every(url=>url.startsWith(origin+'/')||url===alzaImage||new URL(url).hostname==='fonts.googleapis.com'),'no new external/private service calls beyond the fully fulfilled synthetic image '+role);await context.close();
  }
  console.log(JSON.stringify({passed:true,checks,syntheticDatabase:true,noProductionDataOrServiceChanges:true,roleIsolation:true,realServerActions:true,viewports:[1440,1101,1024,390,320]}));
}finally{
  if(browser)await browser.close();child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));
  unlinkSync(join(fixture,'node_modules'));rmSync(fixture,{recursive:true,force:true});
}
