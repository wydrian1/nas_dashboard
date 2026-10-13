// Entirely isolated app installation/build, synthetic database and identities.
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, unlinkSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createServer as httpServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { sessionToken } from '../lib/session.ts';
import { initializeDatabase } from '../lib/schema.ts';
const root=process.cwd(),temporary=process.platform==='win32'?join(tmpdir(),'opencode'):tmpdir();mkdirSync(temporary,{recursive:true});
const fixture=mkdtempSync(join(temporary,'nullpont-browser-'));
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin='http://127.0.0.1:'+port,secret=randomBytes(32).toString('base64url'),owner='one@example.test',other='two@example.test';
const bridgeSecret=randomBytes(32).toString('base64url'),codes=new Map();let exchanges=0;
const dashboard=httpServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/nullpont/authorize'){
    const code=randomBytes(32).toString('base64url');codes.set(code,url.searchParams.get('challenge'));
    const callback=new URL('/api/sso/callback',origin);callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code',code);
    response.writeHead(303,{Location:callback.href});response.end();return;
  }
  if(url.pathname==='/api/nullpont/redeem'&&request.method==='POST'&&request.headers.authorization==='Bearer '+bridgeSecret){
    let body='';for await(const chunk of request)body+=chunk;
    const {code,verifier}=JSON.parse(body);
    if(codes.get(code)===createHash('sha256').update(verifier).digest('base64url')){codes.delete(code);exchanges++;response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({email:owner}));return;}
  }
  response.writeHead(401);response.end();
});await new Promise(resolve=>dashboard.listen(0,'127.0.0.1',resolve));const dashboardOrigin='http://127.0.0.1:'+dashboard.address().port;
cpSync(join(root,'.next-staging'),join(fixture,'.next'),{recursive:true,filter:path=>path!==join(root,'.next-staging','cache')});
symlinkSync(join(root,'node_modules'),join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');
writeFileSync(join(fixture,'package.json'),' {"type":"module"}');writeFileSync(join(fixture,'next.config.mjs'),'export default {distDir:".next"}');mkdirSync(join(fixture,'data'));
const database=new DatabaseSync(join(fixture,'data/nullpont.sqlite'));initializeDatabase(database);database.exec('PRAGMA journal_mode=WAL');
for(const email of [owner,other])database.prepare('INSERT INTO players VALUES(?,1)').run(email);
const child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,AUTH_URL:origin,AUTH_SECRET:secret,NULLPONT_DASHBOARD_URL:dashboardOrigin,NULLPONT_SSO_SECRET:bridgeSecret,NULLPONT_DATA_DIR:join(fixture,'data'),NULLPONT_ALLOWED_EMAILS:'',NEXT_TELEMETRY_DISABLED:'1',DASHBOARD_BUILD_DIR:''}});
let log='',browser,checks=0;for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;});
const check=(value,message)=>{assert.ok(value,message);checks++;};
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture startup timeout')),30000);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Fixture exited'));});child.stdout.on('data',()=>{if(log.includes('Ready in')){clearTimeout(timer);resolve();}});});
  browser=await chromium.launch({headless:true});
  const token=async email=>sessionToken(email,secret);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route=>[origin,dashboardOrigin].some(base=>route.request().url().startsWith(base+'/'))?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?signedout=1');check(await page.getByRole('button',{name:'Folytatás a dashboard-belépéssel'}).count()===1,'signed out notice has dashboard continuation');
  await context.addCookies([{name:'authjs.session-token',value:await token(owner),url:origin}]);await page.reload();check(await page.getByRole('button',{name:'Folytatás a dashboard-belépéssel'}).count()===1,'dashboard cookie cannot log into standalone app');
  await page.goto(origin);await page.locator('.game-grid').waitFor();check(exchanges===1,'automatic PKCE handoff establishes local session without Google prompt');
  check(!new URL(page.url()).search,'callback code removed from browser address');
  const cookie=(await context.cookies()).find(cookie=>cookie.name==='nullpont.session-token');check(cookie?.httpOnly&&cookie?.sameSite==='Lax','local session is HttpOnly SameSite Lax');
  await page.goto(origin+'/api/sso/callback?state=forged&code='+'a'.repeat(43));await page.waitForURL('**/?sso=failed');check(exchanges===1,'forged callback does not redeem');await page.goto(origin);
  check(await page.locator('.environment button').count()===0,'environment starts undiscovered');check(await page.locator('.movement .choices button').count()===0,'unknown exits hidden');
  check(await page.locator('.actions .verbs button').count()===6,'generic verbs, not solution buttons');
  check(!await page.locator('body').innerText().then(text=>text.includes('Fólia + huzal')),'no recipe spoiler');
  for(const width of [1440,800,390,320]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+width);if(process.env.NULLPONT_SCREENSHOT_DIR&&[1440,390].includes(width))await page.screenshot({path:join(process.env.NULLPONT_SCREENSHOT_DIR,'nullpont-'+width+'.png'),fullPage:true});}
  let turns=0;
  const step=async action=>{await action();turns++;await page.getByRole('status').filter({hasText:`· ${turns}. lépés`}).waitFor();};
  const execute=async verb=>{await page.locator('.actions .verbs').getByRole('button',{name:verb,exact:true}).click();await step(()=>page.getByRole('button',{name:'Végrehajtás',exact:true}).click());};
  const target=async label=>page.locator('.environment').getByRole('button',{name:label,exact:true}).click();
  const stale=await context.newPage();await stale.goto(origin);
  const sent=page.waitForRequest(request=>request.method()==='POST'&&!!request.headers()['next-action']);
  await step(()=>page.getByRole('button',{name:'Körülnézek',exact:true}).click());const request=await sent;
  await stale.getByRole('button',{name:'Körülnézek',exact:true}).click();await stale.getByRole('alert').filter({hasText:'Másik böngészőfülben'}).waitFor();check(await stale.getByRole('status').textContent().then(text=>text.includes('1. lépés')),'stale tab cannot overwrite');await stale.close();
  check(await page.locator('.environment button').count()===4,'looking reveals four visible objects');
  await target('Fekvőlap');await execute('Megvizsgálom');check(await page.locator('.environment').getByRole('button',{name:'Fóliadarab',exact:true}).count()===1,'examining reveals loose item');
  await target('Fóliadarab');await execute('Felveszem');check(await page.locator('.environment').getByRole('button',{name:'Fóliadarab',exact:true}).count()===0,'taken item removed from environment');
  await target('Falpanel');await execute('Megvizsgálom');await target('Huzaldarab');await execute('Felveszem');
  await page.reload();check(await page.locator('.inventory button').count()===2,'inventory and discoveries resume');
  await page.locator('.inventory').getByRole('button',{name:'Vezető fólia',exact:true}).click();await target('Hangszóró');await execute('Használom');check(await page.locator('.inventory button').count()===2,'failed use consumes nothing');
  await page.getByRole('button',{name:'Kijelölés törlése'}).click();await page.locator('.inventory').getByRole('button',{name:'Vezető fólia',exact:true}).click();await page.locator('.inventory').getByRole('button',{name:'Szigetelt huzal',exact:true}).click();
  check(await page.locator('[data-selection=source]').count()===1&&await page.locator('[data-selection=target]').count()===1,'inventory source and target are distinct');
  if(process.env.NULLPONT_SCREENSHOT_DIR){await page.setViewportSize({width:1440,height:1000});await page.locator('.actions .verbs').getByRole('button',{name:'Kombinálom',exact:true}).click();await page.screenshot({path:join(process.env.NULLPONT_SCREENSHOT_DIR,'nullpont-exploration-1440.png'),fullPage:true});}
  await execute('Kombinálom');check(await page.locator('.inventory button').count()===1,'combination discovered by attempting, not pre-suggested');
  await page.locator('.inventory').getByRole('button',{name:'Áthidaló hurok',exact:true}).click();await target('Falpanel');await execute('Használom');
  await target('Hangszóró');await execute('Beszélek');await page.locator('.actions select').selectOption('identity');await execute('Beszélek');await execute('Megtámadom');
  await step(()=>page.getByRole('button',{name:'Az ajtó felé',exact:true}).click());await page.reload();check(await page.locator('.scene h2').textContent()==='02 · A küszöb','room resumes across reload');
  await page.locator('.book summary').click();check(await page.locator('.book article').count()===6,'milestones persist as narrative book');
  await step(()=>page.getByRole('button',{name:'Vissza a szobába',exact:true}).click());check(await page.locator('.environment button').count()===4,'discoveries survive travel');
  const anonymous=await browser.newContext(),isolated=await anonymous.newPage();await anonymous.addCookies([{name:'nullpont.session-token',value:await token(other),url:origin}]);await isolated.goto(origin);check(await isolated.locator('.environment button').count()===0,'second account has independent discoveries');await anonymous.close();
  const before=database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json;
  const blocked=await fetch(origin+'/',{method:'POST',headers:{'next-action':request.headers()['next-action'],'content-type':request.headers()['content-type'],cookie:'nullpont.session-token='+await token(owner),origin:'https://foreign.example.test'},body:request.postData()});await blocked.body?.cancel();check(blocked.status>=400,'cross-origin server action rejected');check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json===before,'CSRF attempt preserves progress');
  database.prepare('UPDATE players SET enabled=0 WHERE email=?').run(owner);await page.getByRole('button',{name:'Körülnézek',exact:true}).click();await page.getByRole('alert').filter({hasText:'hozzáférés megszűnt'}).waitFor();check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json===before,'revoked session cannot advance game');
  check(errors.length===0,'no browser errors: '+errors.join(', '));await context.close();
  console.log(JSON.stringify({passed:true,checks,independentInstallation:true,syntheticDatabase:true,noProductionChanges:true}));
}finally{if(browser)await browser.close();await new Promise(resolve=>dashboard.close(resolve));database.close();child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));unlinkSync(join(fixture,'node_modules'));rmSync(fixture,{recursive:true,force:true});}
