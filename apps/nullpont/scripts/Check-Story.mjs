import {readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export const STORY_CHECKS=['canon','continuity','agency','interest','reveals','playability','storybook','extension'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const byCodePoint=(a,b)=>{
  const left=[...a.name],right=[...b.name];
  for(let i=0;i<Math.min(left.length,right.length);i++){
    const difference=left[i].codePointAt(0)-right[i].codePointAt(0);
    if(difference)return difference;
  }
  return left.length-right.length;
};
export function storyInputs(root=process.cwd()){
  root=resolve(root);
  function safe(path){
    const absolute=resolve(root,path),inside=relative(root,absolute);
    if(inside==='..'||inside.startsWith('../')||inside.startsWith('..\\'))throw new Error('Unsafe story input: '+path);
    let cursor=root,stat=lstatSync(cursor);
    for(const part of ['',...inside.split(/[\\/]/).filter(Boolean)]){
      if(part)cursor=join(cursor,part);
      stat=lstatSync(cursor);
      const boundary=relative(realpathSync(root),realpathSync(cursor));
      if(stat.isSymbolicLink()||(!stat.isDirectory()&&stat.nlink!==1)||boundary==='..'||boundary.startsWith('../')||boundary.startsWith('..\\'))throw new Error('Unsafe story input: '+path);
    }
    return stat;
  }
  safe('.');
  const chapters=[];
  function visit(folder){if(!safe(folder).isDirectory())throw new Error('Chapter directory missing');for(const entry of readdirSync(join(root,folder),{withFileTypes:true}).sort(byCodePoint)){const path=folder+'/'+entry.name,stat=safe(path);if(stat.isDirectory())visit(path);else if(path.endsWith('.ts'))chapters.push({module:path,sha256:hash(readFileSync(join(root,path)))});else throw new Error('Unsupported chapter artifact: '+path);}}
  visit('lib/game/chapters');if(!chapters.length)throw new Error('No story modules');
  const context=['lib/game/catalog.ts','lib/game/types.ts','lib/game/engine.ts','lib/game/view.ts'].map(path=>{safe(path);return [path,hash(readFileSync(join(root,path)))];});
  const presentation=[];
  function visualInputs(folder){
    if(!safe(folder).isDirectory())throw new Error('Presentation directory missing');
    for(const entry of readdirSync(join(root,folder),{withFileTypes:true}).sort(byCodePoint)){
      const path=folder+'/'+entry.name,stat=safe(path);
      if(/(?:^|\/)(?:storyboard|canon-ledger|private[-_]?reviews?)(?:[./_-]|$)/i.test(path))throw new Error('Private presentation artifact rejected');
      if(stat.isDirectory())visualInputs(path);
      else if(stat.isFile()&&/\.(?:ts|json)$/.test(path))presentation.push([path,hash(readFileSync(join(root,path)))]);
      else throw new Error('Unsupported presentation artifact: '+path);
    }
  }
  visualInputs('lib/game/presentation');
  if(!presentation.length)throw new Error('Presentation inputs missing');
  const visualPaths=new Set(presentation.map(([path])=>path));
  for(const [path]of presentation.filter(([path])=>path.endsWith('.ts'))){
    const source=ts.createSourceFile(path,readFileSync(join(root,path),'utf8'),ts.ScriptTarget.Latest,true);
    const dependency=specifier=>{
      if(!ts.isStringLiteral(specifier))throw new Error('Dynamic presentation dependency rejected');
      const imported=specifier.text;
      if(!imported.startsWith('.')||/[\\?#]/.test(imported))throw new Error('External presentation dependency rejected');
      const target=relative(root,resolve(root,path,'..',imported)).replaceAll('\\','/');
      if(target!=='lib/game/types.ts'&&!visualPaths.has(target))throw new Error('Uncovered presentation dependency: '+target);
    };
    const inspect=node=>{
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier)dependency(node.moduleSpecifier);
      if(ts.isImportEqualsDeclaration(node)||ts.isImportTypeNode(node))throw new Error('Indirect presentation dependency rejected');
      if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require'))throw new Error('Dynamic presentation dependency rejected');
      if(ts.isIdentifier(node)&&['process','global','globalThis','fetch','XMLHttpRequest','WebSocket','eval','Function','Deno','Bun'].includes(node.text))throw new Error('Runtime external presentation input rejected');
      ts.forEachChild(node,inspect);
    };
    inspect(source);
  }
  context.push(...presentation);
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
