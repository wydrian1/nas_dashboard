// Fixed review operations only: no arbitrary commands, paths or script arguments.
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {storyInputs,checkStory} from '../../apps/nullpont/scripts/Check-Story.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const game=fileURLToPath(new URL('../../apps/nullpont/',import.meta.url));
function run(command,args,cwd){const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});if(result.error)throw result.error;process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');if(result.status!==0)process.exit(result.status??1);}
const operation=process.argv[2];
if(process.argv.length!==3||!['inputs','check','test','timestamp','storyboard-hash','diff','status'].includes(operation))throw Error('Usage: story-steward.mjs inputs|check|test|timestamp|storyboard-hash|diff|status');
if(operation==='inputs')console.log(JSON.stringify(storyInputs(game),null,2));
if(operation==='check')console.log(JSON.stringify(checkStory(game),null,2));
if(operation==='timestamp')console.log(new Date().toISOString());
if(operation==='storyboard-hash')console.log(createHash('sha256').update(readFileSync('D:/!nas/.runtime/nullpont-story/storyboard.md')).digest('hex'));
if(operation==='test'){
  const folder=new URL('../../apps/nullpont/tests/',import.meta.url);
  const tests=readdirSync(folder).filter(name=>name.endsWith('.test.ts')).sort();
  if(!tests.length)throw Error('Game tests missing');
  for(const name of tests){const stat=lstatSync(new URL(name,folder));if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Unsafe game test input');}
  run(process.execPath,['--experimental-strip-types','--test',...tests.map(name=>'tests/'+name)],game);
  run(process.execPath,['--experimental-strip-types','--test','tests/nullpont-story-steward.test.ts'],root);
}
if(operation==='diff')run('D:/!nas/.runtime/git/cmd/git.exe',['diff','--','.opencode','apps/nullpont','docs/nullpont-ascii-art.md','docs/nullpont-story-review.md','tests/nullpont-story-steward.test.ts'],root);
if(operation==='status')run('D:/!nas/.runtime/git/cmd/git.exe',['status','--short','--branch'],root);
