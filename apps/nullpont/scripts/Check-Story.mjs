import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export const STORY_CHECKS=['canon','continuity','agency','interest','reveals','playability','storybook','extension'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function storyInputs(root=process.cwd()){
  root=resolve(root);
  function safe(path){const absolute=resolve(root,path),stat=lstatSync(absolute);if(stat.isSymbolicLink()||(!stat.isDirectory()&&stat.nlink!==1)||relative(realpathSync(root),realpathSync(absolute)).startsWith('..'))throw new Error('Unsafe story input: '+path);return stat;}
  const chapters=[];
  function visit(folder){if(!safe(folder).isDirectory())throw new Error('Chapter directory missing');for(const entry of readdirSync(join(root,folder),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=folder+'/'+entry.name,stat=safe(path);if(stat.isDirectory())visit(path);else if(path.endsWith('.ts'))chapters.push({module:path,sha256:hash(readFileSync(join(root,path)))});else throw new Error('Unsupported chapter artifact: '+path);}}
  visit('lib/game/chapters');if(!chapters.length)throw new Error('No story modules');
  const context=['lib/game/catalog.ts','lib/game/types.ts','lib/game/engine.ts','lib/game/view.ts'].map(path=>{safe(path);return [path,hash(readFileSync(join(root,path)))];});
  return {chapters,contextSha256:hash(JSON.stringify(context)),checks:STORY_CHECKS};
}
export function checkStory(root=process.cwd()){
  const artifacts=readdirSync(resolve(root,'story'));
  if(artifacts.length!==1||artifacts[0]!=='reviews.json')throw new Error('Unexpected narrative artifact; only spoiler-free reviews.json is allowed');
  const inputs=storyInputs(root),path=resolve(root,'story/reviews.json'),stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||relative(realpathSync(resolve(root)),realpathSync(path)).startsWith('..'))throw new Error('Unsafe review receipt');
  const value=JSON.parse(readFileSync(path,'utf8'));
  const keys=(object,expected)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===expected.length&&expected.every(key=>Object.hasOwn(object,key));
  if(!keys(value,['version','reviews'])||value.version!==1||!Array.isArray(value.reviews)||value.reviews.length!==inputs.chapters.length)throw new Error('Missing/extra or unsupported story approvals');
  const seen=new Set();
  for(const review of value.reviews){
    if(!keys(review,['module','sha256','contextSha256','storyboardSha256','reviewer','status','reviewedAt','checks']))throw new Error('Invalid approval schema');
    const chapter=inputs.chapters.find(entry=>entry.module===review.module);
    if(!chapter||seen.has(review.module))throw new Error('Unknown or duplicate story approval');seen.add(review.module);
    if(review.sha256!==chapter.sha256||review.contextSha256!==inputs.contextSha256)throw new Error('Story changed since steward approval: '+review.module);
    if(review.reviewer!=='nullpont-story-steward'||review.status!=='approved'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(review.reviewedAt)||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)>Date.now()+60000||!/^[a-f0-9]{64}$/.test(review.storyboardSha256))throw new Error('Unapproved or invalid steward receipt');
    if(!Array.isArray(review.checks)||review.checks.length!==STORY_CHECKS.length||new Set(review.checks).size!==STORY_CHECKS.length||!STORY_CHECKS.every(check=>review.checks.includes(check)))throw new Error('Incomplete narrative review');
  }
  return {passed:true,modules:inputs.chapters.length,reviewer:'nullpont-story-steward',privateStoryboardRead:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=='--inputs'))throw new Error('Usage: node scripts/Check-Story.mjs [--inputs]');
  console.log(JSON.stringify(process.argv[2]==='--inputs'?storyInputs():checkStory(),null,2));
}
