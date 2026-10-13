import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=process.cwd(),destination=process.argv[3];
if(process.argv.length!==4||process.argv[2]!=='--destination'||!isAbsolute(destination)||existsSync(destination))throw new Error('Usage: npm run package:release -- --destination <new-absolute-directory>');
const npm=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].find(path=>path&&existsSync(path));
if(!npm)throw new Error('Run with npm run package:release using the installed Node/npm runtime');
const sources=['app','lib','scripts','tests','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','auth.ts','README.md','.env.example'];
function fingerprint(){const files=[];function visit(path){const stat=lstatSync(path);if(stat.isSymbolicLink()||(!stat.isDirectory()&&stat.nlink!==1))throw new Error('Linked source rejected');if(stat.isDirectory())for(const name of readdirSync(path).sort())visit(join(path,name));else files.push([relative(root,path),createHash('sha256').update(readFileSync(path)).digest('hex')]);}for(const path of sources)visit(join(root,path));return files;}
const before=fingerprint();
const original=readFileSync('next-env.d.ts');
function run(args,env={}){const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024,env:{...process.env,...env}});if(result.status!==0)throw new Error('Release verification failed: '+args.join(' ')+'\n'+(result.stdout||'').slice(-3000)+'\n'+(result.stderr||'').slice(-2000));}
try{run([npm,'run','build'],{DASHBOARD_BUILD_DIR:'.next-staging'});}finally{writeFileSync('next-env.d.ts',original);}
run([npm,'test']);run([npm,'run','typecheck']);run([npm,'run','test:browser']);
if(JSON.stringify(fingerprint())!==JSON.stringify(before))throw new Error('Source changed during release verification; no package created');
mkdirSync(destination);
function unlinked(path){if(lstatSync(path).isSymbolicLink())throw new Error('Linked release artifact rejected');return true;}
for(const path of sources)cpSync(path,join(destination,path),{recursive:true,filter:unlinked});
cpSync('.next-staging',join(destination,'.next'),{recursive:true,filter:path=>!path.includes(join('.next-staging','cache'))&&unlinked(path)});
const files=[];
function scan(folder,prefix=''){for(const entry of readdirSync(folder,{withFileTypes:true})){const relative=prefix+entry.name,path=join(folder,entry.name);if(entry.isDirectory())scan(path,relative+'/');else{if(entry.isSymbolicLink()||lstatSync(path).nlink!==1)throw new Error('Linked release artifact rejected');const bytes=readFileSync(path);files.push({path:relative,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
scan(destination);writeFileSync(join(destination,'release-manifest.json'),JSON.stringify({application:'nullpont',version:JSON.parse(readFileSync('package.json')).version,checks:{tests:true,typecheck:true,build:true,browser:true},files},null,2));
console.log(JSON.stringify({application:'nullpont',destination,files:files.length,independent:true,credentialsIncluded:false,dataIncluded:false}));
