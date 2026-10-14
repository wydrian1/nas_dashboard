import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {checkStory,storyInputs,STORY_CHECKS} from '../scripts/Check-Story.mjs';

function fixture(run:(root:string,receipt:any)=>void){
  const base=resolve('.runtime/story-gate-tests');mkdirSync(base,{recursive:true});
  const root=mkdtempSync(join(base,'review-'));
  try{
    mkdirSync(join(root,'lib/game/chapters'),{recursive:true});mkdirSync(join(root,'story'));
    writeFileSync(join(root,'lib/game/chapters/example.ts'),'export const chapter = "synthetic fiction";\n');
    for(const file of ['catalog','types','engine','view'])writeFileSync(join(root,'lib/game',file+'.ts'),'// synthetic '+file+'\n');
    const inputs=storyInputs(root),receipt={version:1,reviews:inputs.chapters.map(chapter=>({...chapter,contextSha256:inputs.contextSha256,storyboardSha256:'a'.repeat(64),reviewer:'nullpont-story-steward',status:'approved',reviewedAt:'2026-10-13T00:00:00.000Z',checks:[...STORY_CHECKS]}))};
    writeFileSync(join(root,'story/reviews.json'),JSON.stringify(receipt));run(root,receipt);
  }finally{rmSync(root,{recursive:true,force:true});}
}
const save=(root:string,value:unknown)=>writeFileSync(join(root,'story/reviews.json'),JSON.stringify(value));

test('published modules have an exact-byte complete steward approval without reading the private storyboard',()=>{
  const result=checkStory(resolve('.'));assert.equal(result.passed,true);assert.ok(result.modules>=1);assert.equal(result.privateStoryboardRead,false);
});
test('gate approves covered public inputs only; chapter edits and additions invalidate approval',()=>{
  fixture((root)=>{assert.equal(checkStory(root).passed,true);writeFileSync(join(root,'lib/game/chapters/example.ts'),'changed');assert.throws(()=>checkStory(root),/changed since/);});
  fixture((root)=>{writeFileSync(join(root,'lib/game/chapters/new.ts'),'unreviewed');assert.throws(()=>checkStory(root),/Missing\/extra/);});
});
test('all shared narrative context edits invalidate chapter review',()=>{
  for(const file of ['catalog','types','engine','view'])fixture(root=>{writeFileSync(join(root,'lib/game',file+'.ts'),'new context');assert.throws(()=>checkStory(root),/changed since/);});
});
test('missing, duplicate, wrong-reviewer, rejected, partial and spoiler-bearing receipts fail closed',()=>{
  const changes=[
    (value:any)=>{value.reviews=[];},
    (value:any)=>{value.reviews.push({...value.reviews[0]});},
    (value:any)=>{value.reviews[0].reviewer='chapter-author';},
    (value:any)=>{value.reviews[0].status='rejected';},
    (value:any)=>{value.reviews[0].checks.pop();},
    (value:any)=>{value.reviews[0].checks[0]=value.reviews[0].checks[1];},
    (value:any)=>{value.reviews[0].storyboardSha256='private story text';},
    (value:any)=>{value.reviews[0].futurePlot='not allowed';},
    (value:any)=>{value.reviews[0].reviewedAt='2099-01-01T00:00:00Z';},
    (value:any)=>{value.reviews[0].module='../unreviewed.ts';},
    (value:any)=>{value.version=2;},
  ];
  for(const change of changes)fixture((root,receipt)=>{change(receipt);save(root,receipt);assert.throws(()=>checkStory(root));});
});
test('nested chapter modules cannot escape review through filenames or links',()=>{
  fixture(root=>{mkdirSync(join(root,'lib/game/chapters/next'));writeFileSync(join(root,'lib/game/chapters/next/scene.ts'),'new');assert.equal(storyInputs(root).chapters.length,2);assert.throws(()=>checkStory(root));});
  fixture(root=>{const outside=join(root,'outside');mkdirSync(outside);writeFileSync(join(outside,'hidden.ts'),'new');symlinkSync(outside,join(root,'lib/game/chapters/linked'),process.platform==='win32'?'junction':'dir');assert.throws(()=>storyInputs(root),/Unsafe/);});
});
test('extra synthetic storyboard or private notes in the public story directory block packaging',()=>{
  for(const name of ['storyboard.md','notes.txt','private-review.json'])fixture(root=>{writeFileSync(join(root,'story',name),'SYNTHETIC NON-PLOT MARKER');assert.throws(()=>checkStory(root),/Unexpected narrative artifact/);});
});
test('release package requires narrative gate before build and never includes private memory or agent context',()=>{
  const source=readFileSync(resolve('scripts/Package-Release.mjs'),'utf8');
  assert.ok(source.indexOf("run([npm,'run','check:story'])")<source.indexOf("run([npm,'run','build']"));
  assert.match(source,/const sources=.*'story\/reviews.json'/);
  assert.doesNotMatch(source,/const sources=.*(?:storyboard|canon-ledger|\.opencode|\.runtime)/);
  assert.match(source,/Private narrative memory must never enter a release/);
});
