// Tests/builds remain unprivileged. Only a sealed, content-hashed package is submitted.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,copyFileSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {digest,deploymentPath} from '../lib/deployment/protocol.ts';
const root=process.cwd(),args=process.argv.slice(2),web=args.includes('--web'),worker=args.includes('--worker'),apk=args.includes('--apk');
if(!args.length||args.some(arg=>!['--web','--worker','--apk'].includes(arg))||new Set(args).size!==args.length)throw new Error('Usage: node scripts/Prepare-Deployment.mjs [--web] [--worker] [--apk]');
if(root!=='D:\\!nas'||!existsSync('.runtime/deployment-client/deploy.json'))throw new Error('Dedicated deployer must be installed first; use the active D: project');
const node=process.execPath,git=join(root,'.runtime/git/cmd/git.exe'),powershell=join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe');
function run(exe,args,env={}){const result=spawnSync(exe,args,{cwd:root,encoding:'utf8',timeout:600_000,env:{...process.env,...env}});if(result.status!==0)throw new Error(`Required check failed: ${args.join(' ')}\n${(result.stdout||'').slice(-3000)}\n${(result.stderr||'').slice(-1000)}`);return result.stdout;}
if(run(git,['status','--porcelain']).trim())throw new Error('Commit intended source before preparing deployment; working tree must be clean');
const commit=run(git,['rev-parse','HEAD']).trim(),declarations=readFileSync('next-env.d.ts','utf8');
const branch=run(git,['branch','--show-current']).trim();if(!branch||run(git,['ls-remote','origin','refs/heads/'+branch]).split(/\s+/)[0]!==commit)throw new Error('Push the exact source commit and create/update its PR before preparing deployment');
try{run(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','scripts/Build-Dashboard.ps1'],{DASHBOARD_BUILD_DIR:'.next-staging',NEXT_TELEMETRY_DISABLED:'1'});}
finally{writeFileSync('next-env.d.ts',declarations);}
const testOutput=run(node,['--experimental-strip-types','--test',...readdirSync('tests').filter(name=>name.endsWith('.test.ts')).map(name=>'tests/'+name)]);
run(node,['node_modules/typescript/bin/tsc','--noEmit']);
if(apk)run(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','scripts/Build-Android.ps1']);
if(run(git,['status','--porcelain']).trim())throw new Error('Checks changed tracked source; review before deployment');
const id=randomBytes(16).toString('hex'),directory=join(root,'.runtime/deployment/inbox',id),files=[];mkdirSync(directory);
function add(source,path){if(!deploymentPath(path))throw new Error('Package path rejected: '+path);const stat=lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new Error('Linked/non-file artifact rejected');const bytes=readFileSync(source);mkdirSync(join(directory,path,'..'),{recursive:true});copyFileSync(source,join(directory,path));files.push({path,size:bytes.length,sha256:digest(bytes)});}
function tree(source,prefix){for(const entry of readdirSync(source,{withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Linked artifact rejected');if(prefix==='web'&&entry.name==='cache')continue;const path=join(source,entry.name),target=prefix+'/'+entry.name;if(entry.isDirectory())tree(path,target);else add(path,target);}}
if(web)tree('.next-staging','web');
if(worker){for(const folder of ['pokemon','mobile','finance'])tree('lib/'+folder,'worker/lib/'+folder);for(const file of ['db-schema','opencode-schema','users','url-policy','feed-download','sql-rows'])add('lib/'+file+'.ts','worker/lib/'+file+'.ts');add('scripts/Pokemon-Worker.ts','worker/scripts/Pokemon-Worker.ts');}
if(apk){const version=readFileSync('android/app/build.gradle','utf8').match(/versionName '([0-9.]+)'/)?.[1];if(!version)throw new Error('APK version missing');add('.runtime/artifacts/Wydrian-NAS-'+version+'.apk','apk/release.apk');}
const manifest={version:1,id,commit,checks:{tests:true,typecheck:true,build:true,worker:true,android:apk},files:files.sort((a,b)=>a.path.localeCompare(b.path))};
writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest));writeFileSync(join(directory,'checks.log'),testOutput);
console.log(JSON.stringify({id,commit,components:{web,worker,apk},files:files.length,manifestSha256:digest(readFileSync(join(directory,'manifest.json'))),message:'Prepared only; submit with Request-Deployment.mjs'}));
