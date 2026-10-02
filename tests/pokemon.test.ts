import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { parseGamerunnerPage, scanGamerunner, gamerunnerProductUrl } from "../lib/pokemon/adapters/gamerunner.ts";
import { gamerunnerFetchUrl } from "../lib/pokemon/fetch-policy.ts";
import { robotsPermission } from "../lib/pokemon/robots.ts";
import { claimScan, finishScan, failScan, shop } from "../lib/pokemon/store.ts";
import { registerTestPhone, pushForShop } from './helpers/push.ts';
import { cancelShopPush } from '../lib/mobile/store.ts';
import { claimPush } from '../lib/mobile/push.ts';
import type { PokemonProduct } from "../lib/pokemon/types.ts";

const fixture=readFileSync(new URL('./fixtures/pokemon/gamerunner/available.html',import.meta.url),'utf8');
const products=parseGamerunnerPage(fixture).products;
function database(){const db=new DatabaseSync(':memory:');initializeDatabase(db);return db;}
function run(db:DatabaseSync,list:PokemonProduct[],now:number){db.prepare("UPDATE pokemon_shops SET next_scan=?").run(now);const owner=claimScan(db,now)!;assert.ok(owner);return finishScan(db,owner,{products:list,total:list.length,pages:1,scannedAt:now},now+1);}
function count(db:DatabaseSync,table:string){return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n;}

test('GameRunner: stable IDs, HUF prices, low stock and preorders with active cart buttons are available',()=>{
  assert.deepEqual(products.map(product=>product.externalID),['3026','3774','3928']);
  assert.deepEqual(products.map(product=>product.availability),['in_stock','in_stock','preorder']);
  assert.equal(products[0].priceHuf,2690);assert.equal(products[0].sku,'POK102783');
  assert.equal(products[0].url,'https://gamerunner.hu/pokemon-tcg-destined-rivals-booster');
});
test('GameRunner: stock label is informational; active cart is authoritative',()=>{
  const parsed=parseGamerunnerPage(fixture.replace('Raktáron','Beszerezhető'));
  assert.equal(parsed.products.length,3);assert.equal(parsed.products[0].availability,'available');
  const disabled=parseGamerunnerPage(fixture.replace('class="button btn btn-primary button-add-to-cart"','class="button btn btn-primary button-add-to-cart disabled"'));
  assert.equal(disabled.products.length,2);assert.equal(disabled.cardCount,3);
});
test('GameRunner: wrong filter, incomplete HTML, mismatching IDs and external links fail closed',()=>{
  assert.throws(()=>parseGamerunnerPage(fixture.replace(' checked','')));
  assert.throws(()=>parseGamerunnerPage(fixture.replace('1 - 3 / 3 termék','1 - 4 / 4 termék')));
  assert.throws(()=>parseGamerunnerPage(fixture.replace('data-product-id="3026"','data-product-id="555"')));
  assert.throws(()=>parseGamerunnerPage('<html>Captcha</html>'));
  assert.throws(()=>gamerunnerProductUrl('https://other.example/product'));
  assert.throws(()=>gamerunnerFetchUrl('https://gamerunner.hu/index.php'));
  assert.throws(()=>gamerunnerFetchUrl('https://gamerunner.hu/gyujtogetos-kartyajatekok/pokemon-tcg?stockfilter=0'));
});
test('GameRunner: all pages must form one complete, unique catalog',async()=>{
  const first=fixture.replace('1 - 3 / 3 termék','1 - 3 / 6 termék');
  const second=fixture.replaceAll('3026','5026').replaceAll('3774','5774').replaceAll('3928','5928').replace('1 - 3 / 3 termék','4 - 6 / 6 termék');
  const requests:string[]=[];
  const options={download:async(url:string)=>{requests.push(url);return url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':url.includes('page=2')?second:first;},wait:async()=>{}};
  const scan=await scanGamerunner(new AbortController().signal,options);
  assert.equal(scan.pages,2);assert.equal(scan.products.length,6);assert.equal(requests.length,3);
  await assert.rejects(scanGamerunner(new AbortController().signal,{...options,download:async(url:string)=>url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':first}));
});
test('robots: longest matching rule, allow tie, specific agent and crawl delay',()=>{
  assert.equal(robotsPermission('User-agent: *\nDisallow: /','/category').allowed,false);
  assert.equal(robotsPermission('User-agent: *\nDisallow: /\nAllow: /category','/category?q=1').allowed,true);
  assert.equal(robotsPermission('User-agent: *\nAllow: /\nUser-agent: WydrianMonitor\nDisallow: /','/category').allowed,false);
  assert.equal(robotsPermission('User-agent: *\nCrawl-delay: 4','/').delayMs,4000);
});
test('baseline sends nothing; unchanged scans stay silent; one new product queues one durable push',()=>{
  const db=database();try{
    registerTestPhone(db);
    assert.equal(run(db,products.slice(0,2),1000).baseline,true);
    assert.equal(count(db,'pokemon_events'),0);assert.equal(count(db,'pokemon_mail_outbox'),0);
    run(db,products.slice(0,2),700_000);assert.equal(count(db,'pokemon_events'),0);
    run(db,products,1400_000);assert.equal(count(db,'pokemon_events'),1);assert.equal(count(db,'mobile_push_outbox'),1);assert.equal(count(db,'pokemon_mail_outbox'),0);
    run(db,products,2100_000);assert.equal(count(db,'pokemon_events'),1);
    assert.match(pushForShop(db,'gamerunner').data.title,/Új előrendelés/);
  }finally{db.close();}
});
test('failed scan preserves products, sets backoff and respects Retry-After',()=>{
  const db=database();try{
    run(db,products,1000);db.exec('UPDATE pokemon_shops SET next_scan=0');
    const owner=claimScan(db,2000)!;failScan(db,owner,'HTTP 429',2*60*60_000,2001);
    assert.equal(count(db,'pokemon_products'),3);assert.equal(count(db,'pokemon_events'),0);
    assert.equal(claimScan(db,5000),null);assert.equal(shop(db).next_scan,2001+2*60*60_000);
  }finally{db.close();}
});
test('restock requires two absent scans; preorder to stock is not a new cart availability',()=>{
  const db=database();try{
    registerTestPhone(db);run(db,products,1000);
    run(db,products.slice(0,2),700_000);run(db,products,1400_000);assert.equal(count(db,'pokemon_events'),0);
    run(db,products.slice(0,2),2100_000);run(db,products.slice(0,2),2800_000);run(db,products,3500_000);
    assert.equal(count(db,'pokemon_events'),1);assert.equal(db.prepare('SELECT kind FROM pokemon_events').get()?.kind,'restock');
    run(db,products.map(product=>({...product,availability:'in_stock'})),4200_000);assert.equal(count(db,'pokemon_events'),1);
  }finally{db.close();}
});
test('suspicious collapse preserves previous state until repeated complete result',()=>{
  const db=database();try{
    run(db,products,1000);assert.equal(run(db,[],700_000).deferred,true);
    assert.equal(shop(db).last_count,3);assert.equal(db.prepare('SELECT SUM(in_stock) AS n FROM pokemon_products').get()?.n,3);
    assert.equal(run(db,[],1400_000).deferred,false);run(db,[],2100_000);
    assert.equal(db.prepare('SELECT SUM(in_stock) AS n FROM pokemon_products').get()?.n,0);assert.equal(count(db,'pokemon_events'),0);
  }finally{db.close();}
});
test('scan lease prevents concurrent scans, expired owner cannot commit',()=>{
  const db=database();try{
    const first=claimScan(db,1000)!;assert.equal(claimScan(db,2000),null);
    assert.ok(claimScan(db,400_000));assert.throws(()=>finishScan(db,first,{products,total:3,pages:1,scannedAt:400_000},400_001));
    assert.equal(count(db,'pokemon_products'),0);
  }finally{db.close();}
});
test('no subscribed phone logs changes without push backlog; legacy email flag cannot create mail',()=>{
  const db=database();try{
    run(db,products.slice(0,2),1000);run(db,products,700_000);
    assert.equal(count(db,'pokemon_events'),1);assert.equal(count(db,'pokemon_mail_outbox'),0);
    db.exec('UPDATE pokemon_shops SET emails_enabled=1');run(db,products,1400_000);assert.equal(count(db,'pokemon_mail_outbox'),0);
    const added={...products[0],externalID:'9000'};run(db,[...products,added],2100_000);
    assert.equal(count(db,'pokemon_mail_outbox'),0);assert.equal(count(db,'mobile_push_outbox'),0);
  }finally{db.close();}
});
test('push claim is exclusive; crash after submission is uncertain, never auto-resubmitted',()=>{
  const db=database();try{
    registerTestPhone(db);run(db,products.slice(0,2),1000);run(db,products,700_000);
    assert.ok(claimPush(db,700_002));assert.equal(claimPush(db,700_003),null);
    assert.equal(claimPush(db,900_000),null);assert.equal(db.prepare('SELECT state FROM mobile_push_outbox').get()?.state,'uncertain');assert.equal(claimPush(db,900_001),null);
  }finally{db.close();}
});
test('SMTP sender, worker imports, test-mail action and UI controls are removed',()=>{
  assert.equal(existsSync(new URL('../lib/pokemon/mail.ts',import.meta.url)),false);
  const worker=readFileSync(new URL('../scripts/Pokemon-Worker.ts',import.meta.url),'utf8');assert.doesNotMatch(worker,/sendNextMail|recoverUncertainMail|pokemon\/mail/);
  const actions=readFileSync(new URL('../app/pokemon-actions.ts',import.meta.url),'utf8');assert.doesNotMatch(actions,/requestPokemonTestMail|SMTP|mailConfigured/);
  const panel=readFileSync(new URL('../app/pokemon-panel.tsx',import.meta.url),'utf8');assert.doesNotMatch(panel,/Tesztlevél|Levélküldési előzmények|name="emails"/);
});
test('failure during push insertion rolls back products and events together',()=>{
  const db=database();try{
    registerTestPhone(db);run(db,products.slice(0,2),1000);
    db.exec("CREATE TRIGGER reject_push BEFORE INSERT ON mobile_push_outbox BEGIN SELECT RAISE(ABORT,'simulated write failure'); END");
    assert.throws(()=>run(db,products,700_000));
    assert.equal(count(db,'pokemon_products'),2);assert.equal(count(db,'pokemon_events'),0);assert.equal(count(db,'pokemon_mail_outbox'),0);
    assert.equal(shop(db).last_count,2);
  }finally{db.close();}
});
test('push cooldown suppresses rapid repeated availability without losing event history',()=>{
  const db=database();try{
    registerTestPhone(db);run(db,products.slice(0,2),1000);run(db,products,700_000);
    run(db,products.slice(0,2),1400_000);run(db,products.slice(0,2),2100_000);run(db,products,2800_000);
    assert.equal(count(db,'pokemon_events'),2);assert.equal(count(db,'mobile_push_outbox'),1);assert.equal(count(db,'pokemon_mail_outbox'),0);
  }finally{db.close();}
});
test('worker/dashboard reinitialization preserves baseline, schedule, settings and durable jobs',()=>{
  const db=database();try{
    registerTestPhone(db);db.exec('UPDATE pokemon_shops SET interval_minutes=25');run(db,products.slice(0,2),1000);run(db,products,1600_000);
    const before=shop(db);initializeDatabase(db);
    assert.deepEqual(shop(db),before);assert.equal(count(db,'pokemon_events'),1);assert.equal(count(db,'mobile_push_outbox'),1);
    assert.equal(run(db,products,3200_000).baseline,false);assert.equal(count(db,'pokemon_events'),1);
  }finally{db.close();}
});
test('retiring email preserves historical jobs, baselines and push registrations, cancels only pending mail once',()=>{
  const db=database();try{
    registerTestPhone(db);run(db,products,1000);const baseline=shop(db).baseline_at;
    db.exec("DELETE FROM pokemon_migrations WHERE id='retire-email-v1'; UPDATE pokemon_shops SET emails_enabled=1; INSERT INTO pokemon_mail_outbox(id,kind,payload,state,created_at) VALUES('old-queued','changes','{}','queued',1),('old-sent','changes','{}','sent',1),('old-sending','changes','{}','sending',1);");
    initializeDatabase(db);assert.equal(shop(db).emails_enabled,0);assert.equal(shop(db).baseline_at,baseline);
    assert.equal(count(db,'pokemon_mail_outbox'),3);assert.equal(db.prepare("SELECT state FROM pokemon_mail_outbox WHERE id='old-queued'").get()?.state,'cancelled');
    assert.equal(db.prepare("SELECT state FROM pokemon_mail_outbox WHERE id='old-sent'").get()?.state,'sent');assert.equal(db.prepare("SELECT state FROM pokemon_mail_outbox WHERE id='old-sending'").get()?.state,'sending');
    assert.equal(db.prepare('SELECT push_enabled FROM mobile_devices').get()?.push_enabled,1);
    const preserved=shop(db);initializeDatabase(db);assert.deepEqual(shop(db),preserved);
  }finally{db.close();}
});
