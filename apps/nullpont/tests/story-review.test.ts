import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,unlinkSync,renameSync,linkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {checkStory,storyInputs,STORY_CHECKS} from '../scripts/Check-Story.mjs';

function fixture(run:(root:string,receipt:any)=>void){
  const base=resolve('.runtime/story-gate-tests');mkdirSync(base,{recursive:true});
  const root=mkdtempSync(join(base,'review-'));
  try{
    mkdirSync(join(root,'lib/game/chapters'),{recursive:true});mkdirSync(join(root,'story'));
    writeFileSync(join(root,'lib/game/chapters/example.ts'),'export const chapter = "synthetic fiction";\n');
    for(const file of ['catalog','types','engine','view'])writeFileSync(join(root,'lib/game',file+'.ts'),'// synthetic '+file+'\n');
    mkdirSync(join(root,'lib/game/presentation/art'),{recursive:true});
    writeFileSync(join(root,'lib/game/presentation/index.ts'),'import drawing from "./art/scenes.json" with {type:"json"};\nexport {drawing};\n');
    writeFileSync(join(root,'lib/game/presentation/art/scenes.json'),'{"synthetic":"scene"}');
    writeFileSync(join(root,'lib/game/presentation/bindings.json'),'{"synthetic":"binding"}');
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
test('all presentation bytes and paths are deterministic reviewed inputs, including bindings and loader',()=>{
  fixture(root=>assert.deepEqual(storyInputs(root),storyInputs(root)));
  for(const file of ['index.ts','art/scenes.json','bindings.json'])fixture(root=>{
    const path=join(root,'lib/game/presentation',file);
    writeFileSync(path,readFileSync(path,'utf8')+'\n');
    assert.throws(()=>checkStory(root),/changed since/);
  });
  fixture(root=>{writeFileSync(join(root,'lib/game/presentation/new.ts'),'// new visual dependency');assert.throws(()=>checkStory(root),/changed since/);});
  fixture(root=>{unlinkSync(join(root,'lib/game/presentation/bindings.json'));assert.throws(()=>checkStory(root),/changed since/);});
  fixture(root=>{renameSync(join(root,'lib/game/presentation/bindings.json'),join(root,'lib/game/presentation/renamed.json'));assert.throws(()=>checkStory(root),/changed since/);});
  fixture(root=>{unlinkSync(join(root,'lib/game/presentation/art/scenes.json'));assert.throws(()=>storyInputs(root),/Uncovered presentation dependency/);});
});
test('presentation dependencies cannot escape the reviewed input graph or introduce runtime external data',()=>{
  const imports=['import "../engine.ts";','import "node:fs";','export {x} from "../../outside.ts";','const x=import("./other.ts");','const x=require("node:fs");','const x=fetch("https://example.test");','const x=process.env.ART;','const x=globalThis["fetch"];'];
  for(const source of imports)fixture(root=>{writeFileSync(join(root,'lib/game/presentation/index.ts'),source);assert.throws(()=>storyInputs(root),/presentation (?:dependency|input)/);});
  fixture(root=>{writeFileSync(join(root,'lib/game/presentation/index.ts'),'import type {GameState} from "../types.ts";\n');assert.doesNotThrow(()=>storyInputs(root));});
});
test('presentation directories and files reject links, private-looking and unsupported synthetic artifacts',()=>{
  for(const name of ['art/debug.txt','art/private-review.json','storyboard.ts','canon-ledger.json'])fixture(root=>{writeFileSync(join(root,'lib/game/presentation',name),'SYNTHETIC NON-PLOT MARKER');assert.throws(()=>storyInputs(root),/presentation artifact/);});
  fixture(root=>{
    const outside=join(root,'synthetic-art');mkdirSync(outside);writeFileSync(join(outside,'other.json'),'{}');
    symlinkSync(outside,join(root,'lib/game/presentation/linked'),process.platform==='win32'?'junction':'dir');
    assert.throws(()=>storyInputs(root),/Unsafe/);
  });
  fixture(root=>{
    const path=join(root,'lib/game/presentation/art/scenes.json');linkSync(path,join(root,'synthetic-hardlink.json'));
    assert.throws(()=>storyInputs(root),/Unsafe/);
  });
  fixture(root=>{
    const path=join(root,'lib/game/presentation');renameSync(path,path+'-original');symlinkSync(path+'-original',path,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>storyInputs(root),/Unsafe/);
  });
});
test('intermediate lib and game directories cannot redirect reviewed inputs through internal junctions',()=>{
  for(const folder of ['lib','lib/game'])fixture(root=>{
    const path=join(root,folder),target=join(root,'synthetic-redirect-target');
    renameSync(path,target);
    symlinkSync(target,path,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>storyInputs(root),/Unsafe story input/);
  });
});
test('review input ordering is independent of creation order, case and locale collation',()=>{
  let expected:ReturnType<typeof storyInputs>;
  const names=['Zebra.ts','apple.ts','Árnyék.ts','Éj.ts'];
  fixture(root=>{
    for(const name of names){writeFileSync(join(root,'lib/game/chapters',name),'// '+name);writeFileSync(join(root,'lib/game/presentation',name),'// '+name);}
    expected=storyInputs(root);
    assert.deepEqual(expected.chapters.map((entry:{module:string})=>entry.module.split('/').at(-1)),['Zebra.ts','apple.ts','example.ts','Árnyék.ts','Éj.ts']);
  });
  fixture(root=>{
    for(const name of [...names].reverse()){writeFileSync(join(root,'lib/game/chapters',name),'// '+name);writeFileSync(join(root,'lib/game/presentation',name),'// '+name);}
    const original=String.prototype.localeCompare;
    try{String.prototype.localeCompare=()=>{throw new Error('Locale collation must not be used');};assert.deepEqual(storyInputs(root),expected);}finally{String.prototype.localeCompare=original;}
  });
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
