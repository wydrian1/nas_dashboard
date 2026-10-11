import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';

export function checkedRelease(root=process.cwd(),productionEnvironment=false){
  const git=existsSync(join(root,'.runtime/git/cmd/git.exe'))?join(root,'.runtime/git/cmd/git.exe'):'git';
  function run(exe,args,cwd=root,env={}){const result=spawnSync(exe,args,{cwd,encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024,env:{...process.env,...env}});if(result.status!==0)throw new Error('Release check failed: '+args.join(' ')+'\n'+(result.stdout||'').slice(-4000)+'\n'+(result.stderr||'').slice(-2000));return result.stdout;}
  if(run(git,['status','--porcelain']).trim())throw new Error('Release verification requires clean committed source');
  const commit=run(git,['rev-parse','HEAD']).trim();
  const base=join(root,'.runtime/verification');mkdirSync(base,{recursive:true});
  const workspace=mkdtempSync(join(base,'source-')),archive=join(workspace,'source.tar'),source=join(workspace,'source');mkdirSync(source);
  run(git,['archive','--format=tar','--output='+archive,commit]);run('tar',['-xf',archive,'-C',source]);
  const npm=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].find(path=>path&&existsSync(path));
  if(!npm)throw new Error('Run with npm run check:release or provide the local Node/npm runtime');
  run(process.execPath,[npm,'ci','--ignore-scripts','--no-audit','--no-fund'],source);
  run(process.execPath,['node_modules/playwright/cli.js','install',...(process.env.CI==='true'?['--with-deps']:[]),'chromium'],source);
  const tests=run(process.execPath,[npm,'test'],source);
  run(process.execPath,['--test','docs/history-site.test.mjs'],source);
  run(process.execPath,[npm,'run','build'],source,{...(productionEnvironment?parseEnv(readFileSync(join(root,'.env.local'),'utf8')):{}),DASHBOARD_BUILD_DIR:'.next-staging',NEXT_TELEMETRY_DISABLED:'1'});
  run(process.execPath,[npm,'run','typecheck'],source);
  run(process.execPath,['scripts/Test-Browser.mjs'],source);
  if(run(git,['status','--porcelain']).trim()||run(git,['rev-parse','HEAD']).trim()!==commit)throw new Error('Source changed while checking release');
  const report={commit,source,build:join(source,'.next-staging'),tests:true,typecheck:true,browser:true,isolated:true};
  writeFileSync(join(workspace,'checks.log'),tests);writeFileSync(join(workspace,'result.json'),JSON.stringify(report,null,2));return report;
}
if(process.argv[1]?.endsWith('Check-Release.mjs'))console.log(JSON.stringify(checkedRelease()));
