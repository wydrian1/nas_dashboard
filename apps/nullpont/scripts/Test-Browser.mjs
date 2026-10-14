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
const basePath=process.env.NULLPONT_BASE_PATH||'',origin='http://127.0.0.1:'+port+basePath,secret=randomBytes(32).toString('base64url'),owner='one@example.test',other='two@example.test';
const bridgeSecret=randomBytes(32).toString('base64url'),codes=new Map();let exchanges=0;
const dashboard=httpServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/nullpont/authorize'){
    const code=randomBytes(32).toString('base64url');codes.set(code,url.searchParams.get('challenge'));
    const callback=new URL(origin+'/api/sso/callback');callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code',code);
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
writeFileSync(join(fixture,'package.json'),' {"type":"module"}');writeFileSync(join(fixture,'next.config.mjs'),'export default {distDir:".next",basePath:'+JSON.stringify(basePath)+'}');mkdirSync(join(fixture,'data'));
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
  await context.route('**/*',route=>[origin,dashboardOrigin].some(base=>{const value=route.request().url();return value===base||value.startsWith(base+'/')||value.startsWith(base+'?');})?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?signedout=1');check(await page.getByRole('button',{name:'Folytatás a dashboard-belépéssel'}).count()===1,'signed out notice has dashboard continuation');
  await context.addCookies([{name:'authjs.session-token',value:await token(owner),url:origin}]);await page.reload();check(await page.getByRole('button',{name:'Folytatás a dashboard-belépéssel'}).count()===1,'dashboard cookie cannot log into standalone app');
  await page.goto(origin);await page.locator('.game-grid').waitFor().catch(()=>{throw new Error('Handoff failed at '+new URL(page.url()).pathname+'; '+log.slice(-1600));});check(exchanges===1,'automatic PKCE handoff establishes local session without Google prompt');
  check(!new URL(page.url()).search,'callback code removed from browser address');
  const cookie=(await context.cookies()).find(cookie=>cookie.name==='nullpont.session-token');check(cookie?.httpOnly&&cookie?.sameSite==='Lax'&&cookie?.path===(basePath||'/'),'local session is HttpOnly SameSite Lax and path scoped');
  await page.goto(origin+'/api/sso/callback?state=forged&code='+'a'.repeat(43));await page.waitForURL(url=>url.searchParams.get('sso')==='failed');check(exchanges===1,'forged callback does not redeem');await page.goto(origin);
  check(await page.locator('.ascii-hotspot').count()===0,'environment hotspots start undiscovered');
  check(await page.locator('.environment,.movement').count()===0,'separate environment/movement menus removed');
  check(!await page.locator('body').innerText().then(text=>text.includes('Fólia + huzal')),'no recipe spoiler');
  for(const width of [1440,800,390,320]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+width);if(process.env.NULLPONT_SCREENSHOT_DIR&&[1440,390].includes(width))await page.screenshot({path:join(process.env.NULLPONT_SCREENSHOT_DIR,'nullpont-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});
  let turns=0;
  const status=page.locator('.scene-heading [role=status]');
  const step=async action=>{await action();turns++;await status.filter({hasText:`· ${turns}. lépés`}).waitFor();};
  const object=label=>page.locator('.ascii-canvas').getByRole('button',{name:label,exact:true});
  const action=async(label,verb)=>{await object(label).click();await step(()=>page.locator('.context-popup').getByRole('button',{name:verb,exact:true}).click());};
  const arm=async(label,verb)=>{await page.locator('.inventory').getByRole('button',{name:label,exact:true}).click();await page.locator('.context-popup').getByRole('button',{name:verb,exact:true}).click();};
  const stale=await context.newPage();await stale.goto(origin);
  const sent=page.waitForRequest(request=>request.method()==='POST'&&!!request.headers()['next-action']);
  await step(()=>page.getByRole('button',{name:'Körülnézek',exact:true}).click());const request=await sent;
  await stale.getByRole('button',{name:'Körülnézek',exact:true}).click();await stale.getByRole('alert').filter({hasText:'Másik böngészőfülben'}).waitFor();check(await stale.locator('.scene-heading [role=status]').textContent().then(text=>text.includes('1. lépés')),'stale tab cannot overwrite');await stale.close();
  check(await page.locator('.ascii-hotspot').count()===4,'looking reveals four objects on the drawing');
  await object('Fekvőlap').hover();await page.locator('.context-popup').getByRole('button',{name:'Megvizsgálom'}).waitFor();check(await page.locator('.context-popup').getByRole('button',{name:'Megvizsgálom'}).count()===1,'mouseover shows object name and actions');
  await object('Fekvőlap').focus();await page.keyboard.press('ArrowDown');check(await page.locator('.context-popup').getByRole('button').first().evaluate(element=>document.activeElement===element),'keyboard can enter popup actions');await page.keyboard.press('Escape');check(await page.locator('.context-popup').count()===0,'Escape closes popup without reopening on focus');
  await action('Fekvőlap','Megvizsgálom');check(await object('Fóliadarab').count()===1,'examining reveals item glyph/hotspot');
  await action('Fóliadarab','Felveszem');check(await object('Fóliadarab').count()===0,'taken glyph disappears from scene');
  await action('Falpanel','Megvizsgálom');await action('Huzaldarab','Felveszem');
  await page.reload();check(await page.locator('.inventory button').count()===2,'inventory and discoveries resume');
  check(await page.locator('.inventory-item').first().innerText().then(text=>!text.includes('fólia')),'inventory displays ASCII objects rather than permanent name labels');
  await arm('Vezető fólia','Használom');await step(()=>object('Hangszóró').click());check(await page.locator('.inventory button').count()===2,'failed targeted use consumes nothing');
  if(process.env.NULLPONT_SCREENSHOT_DIR){await page.setViewportSize({width:1440,height:1000});await object('Falpanel').hover();await page.screenshot({path:join(process.env.NULLPONT_SCREENSHOT_DIR,'nullpont-exploration-1440.png'),fullPage:true});}
  await arm('Vezető fólia','Kombinálom');check(await page.locator('.inventory-item[aria-pressed=true]').count()===1,'combination source highlighted');await step(()=>page.locator('.inventory').getByRole('button',{name:'Szigetelt huzal',exact:true}).click());check(await page.locator('.inventory button').count()===1,'second inventory click combines without a recipe menu');
  await arm('Áthidaló hurok','Használom');await step(()=>object('Falpanel').click());
  await action('Hangszóró','Beszélek');await action('Hangszóró','Ki vagyok?');await action('Hangszóró','Megtámadom');
  await object('Ajtó').hover();check(await page.locator('.context-popup').innerText().then(text=>text.includes('Kattintás: mozgás')),'exit tooltip explains direct movement');
  await step(()=>object('Ajtó').click());await page.reload();check(await page.locator('.scene h2').textContent()==='02 · A küszöb','direct ASCII movement resumes across reload');
  await page.locator('.book summary').click();check(await page.locator('.book article').count()===6,'milestones persist as narrative book');
  await step(()=>object('Vissza a szobába').click());check(await page.locator('.ascii-hotspot').count()===4,'discovered hotspots survive travel');
  const anonymous=await browser.newContext({hasTouch:true,viewport:{width:390,height:900}}),isolated=await anonymous.newPage();await anonymous.addCookies([{name:'nullpont.session-token',value:await token(other),url:origin}]);await isolated.goto(origin);check(await isolated.locator('.ascii-hotspot').count()===0,'second account has independent discoveries');
  await isolated.getByRole('button',{name:'Körülnézek',exact:true}).tap();await isolated.locator('.scene-heading [role=status]').filter({hasText:'1. lépés'}).waitFor();await isolated.locator('.ascii-canvas').getByRole('button',{name:'Fekvőlap',exact:true}).tap();check(await isolated.locator('.context-popup').getByRole('button',{name:'Megvizsgálom'}).isVisible(),'touch reveals actions without hover');await isolated.locator('.context-popup').getByRole('button',{name:'Megvizsgálom'}).tap();await isolated.locator('.scene-heading [role=status]').filter({hasText:'2. lépés'}).waitFor();
  const otherBefore=database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(other).state_json;
  const beforeCancel=database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json;await page.getByRole('button',{name:'Játék újrakezdése'}).click();check(await page.getByRole('dialog',{name:'Biztosan elölről kezded?'}).isVisible(),'restart requires explicit confirmation');await page.getByRole('button',{name:'Mégsem',exact:true}).click();check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json===beforeCancel,'cancel reset preserves progress');
  const staleReset=await context.newPage();await staleReset.goto(origin);await step(()=>page.getByRole('button',{name:'Körülnézek',exact:true}).click());const freshBeforeReset=database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json;
  await staleReset.getByRole('button',{name:'Játék újrakezdése'}).click();await staleReset.getByRole('button',{name:'Igen, elölről kezdem'}).click();await staleReset.getByRole('alert').filter({hasText:'Az újrakezdés nem történt meg'}).waitFor();check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json===freshBeforeReset,'stale reset cannot erase newer progress');
  await page.getByRole('button',{name:'Játék újrakezdése'}).click();const resetSent=page.waitForRequest(request=>request.method()==='POST'&&!!request.headers()['next-action']);await page.getByRole('button',{name:'Igen, elölről kezdem'}).click();const resetRequest=await resetSent;turns=0;await status.filter({hasText:'0. lépés'}).waitFor();check(await page.locator('.ascii-hotspot,.inventory-item').count()===0,'reset restores discoveries and inventory');check(await page.locator('.book article').count()===1,'reset restores opening book only');
  await page.reload();check(await page.locator('.story').innerText().then(text=>text.includes('Hideg padlón ébredsz')),'reset opening persists after reload');check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(other).state_json===otherBefore,'reset isolates accounts');
  await staleReset.getByRole('button',{name:'Körülnézek',exact:true}).click();await staleReset.getByRole('alert').filter({hasText:'Másik böngészőfülben'}).waitFor();check(await staleReset.locator('.scene-heading [role=status]').textContent().then(text=>text.includes('0. lépés')),'pre-reset tab cannot overwrite restarted game');await staleReset.close();await anonymous.close();
  const before=database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json;
  const blocked=await fetch(origin+'/',{method:'POST',headers:{'next-action':request.headers()['next-action'],'content-type':request.headers()['content-type'],cookie:'nullpont.session-token='+await token(owner),origin:'https://foreign.example.test'},body:request.postData()});await blocked.body?.cancel();check(blocked.status>=400,'cross-origin server action rejected');check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json===before,'CSRF attempt preserves progress');
  const blockedReset=await fetch(origin+'/',{method:'POST',headers:{'next-action':resetRequest.headers()['next-action'],'content-type':resetRequest.headers()['content-type'],cookie:'nullpont.session-token='+await token(owner),origin:'https://foreign.example.test'},body:resetRequest.postData()});await blockedReset.body?.cancel();check(blockedReset.status>=400,'cross-origin reset rejected');
  database.prepare('UPDATE players SET enabled=0 WHERE email=?').run(owner);await page.getByRole('button',{name:'Körülnézek',exact:true}).click();await page.getByRole('alert').filter({hasText:'hozzáférés megszűnt'}).waitFor();check(database.prepare('SELECT state_json FROM adventure_saves WHERE owner=?').get(owner).state_json===before,'revoked session cannot advance game');
  check(errors.length===0,'no browser errors: '+errors.join(', '));await context.close();
  console.log(JSON.stringify({passed:true,checks,independentInstallation:true,syntheticDatabase:true,noProductionChanges:true}));
}finally{if(browser)await browser.close();await new Promise(resolve=>dashboard.close(resolve));database.close();child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));unlinkSync(join(fixture,'node_modules'));rmSync(fixture,{recursive:true,force:true});}
