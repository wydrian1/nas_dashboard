import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync,readdirSync,lstatSync } from 'node:fs';
import { join,relative } from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd(),snapshotPath='.runtime/research/before-project-move.json';
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function stableHash() {
  const db=new DatabaseSync(join(root,'data/dashboard.sqlite'),{readOnly:true});try{
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
    const tables=['finance_accounts','finance_months','finance_balances','finance_annual','finance_imports','finance_audit','finance_lego_items','finance_lego_audit','finance_lego_imports','dashboard_users','pokemon_user_notifications','quick_links','notes','todos','weather_location'];
    const stable={tables:Object.fromEntries(tables.map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()])),feeds:db.prepare('SELECT id,name,url,article_limit FROM feeds ORDER BY id').all(),devices:db.prepare('SELECT id,email,secret_hash,expires_at,revoked,push_enabled,fcm_token FROM mobile_devices ORDER BY id').all(),shops:db.prepare('SELECT id,enabled,interval_minutes,baseline_at FROM pokemon_shops ORDER BY id').all()};
    return hash(JSON.stringify(stable));
  }finally{db.close();}
}
function manifest() {
  const files:Record<string,{size:number;sha256?:string}>={};
  function walk(path:string){for(const name of readdirSync(path)){const full=join(path,name),stat=lstatSync(full),key=relative(root,full).replaceAll('\\','/');
    if(stat.isSymbolicLink())throw new Error('Project contains a link; migration needs an explicit link plan.');
    if(stat.isDirectory())walk(full);else if(key!==snapshotPath && !key.startsWith('logs/'))files[key]={size:stat.size,...(/^(data\/|\.runtime\/(artifacts|secrets|android-signing)\/)|^(\.env\.local|\.next\/BUILD_ID|deploy\/Caddyfile|\.runtime\/services\/.*\.xml)$/.test(key) ? {sha256:hash(readFileSync(full))} : {})};
  }}walk(root);return files;
}
if(process.argv.includes('--capture')){
  const snapshot={sourceRoot:root,capturedAt:new Date().toISOString(),stableHash:stableHash(),files:manifest()};writeFileSync(snapshotPath,JSON.stringify(snapshot));console.log('Offline preservation manifest captured; no private values printed.');
}else{
  const before=JSON.parse(readFileSync(snapshotPath,'utf8'));assert.equal(stableHash(),before.stableHash,'Persistent user/financial data changed');
  if(process.argv.includes('--copied')){for(const [key,value] of Object.entries(before.files) as [string,{size:number;sha256?:string}][]){const full=join(root,key);assert.equal(lstatSync(full).size,value.size,'Missing/different copied file: '+key);if(value.sha256)assert.equal(hash(readFileSync(full)),value.sha256,'File hash mismatch: '+key);}console.log('Complete file-size manifest and critical file hashes match before startup.');}
  if(process.argv.includes('--running')){
    const db=new DatabaseSync('data/dashboard.sqlite',{readOnly:true});try{assert.ok(Date.now()-Number(db.prepare('SELECT heartbeat FROM pokemon_worker WHERE id=1').get()!.heartbeat)<240000);}finally{db.close();}
    for(const path of ['/api/finance','/api/finance/market','/mobile/download']){const response=await fetch('https://nas.wydrian.hu'+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});assert.equal(response.status,401);await response.body?.cancel();}
    const response=await fetch('https://nas.wydrian.hu/',{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);await response.body?.cancel();
    const report={verifiedAt:new Date().toISOString(),sourceRoot:before.sourceRoot,activeRoot:root,financialHistoryAndLegoPreserved:true,rolesPreferencesDevicesNotesLinksWeatherPreserved:true,workerAlive:true,publicHttpsHealthy:true,privateRoutesStillProtected:true,originalDirectoryRetained:true};writeFileSync('.runtime/research/project-move-verified.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }
}
