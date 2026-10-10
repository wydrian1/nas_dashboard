import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,renameSync,rmSync,symlinkSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTimelinePages,timelineFiles} from '../scripts/Build-Timeline-Pages.mjs';

const source=fileURLToPath(new URL('../docs/history-site/',import.meta.url));
function fixture(run:(directory:string)=>void){
  const directory=mkdtempSync(join(tmpdir(),'timeline-pages-'));
  try{run(directory);}finally{rmSync(directory,{recursive:true,force:true});}
}

test('Pages package contains exactly the standalone story and matches every reviewed source byte',()=>fixture(directory=>{
  const output=join(directory,'site'),files=buildTimelinePages(output);
  assert.deepEqual(files.sort(),[...timelineFiles,'.nojekyll'].sort());assert.equal(files.length,13);
  assert.deepEqual(readdirSync(output).sort(),['.nojekyll','assets','index.html','presentation.js','style.css']);
  assert.deepEqual(readdirSync(join(output,'assets')).sort(),timelineFiles.filter(file=>file.startsWith('assets/')).map(file=>file.slice(7)).sort());
  for(const file of timelineFiles)assert.deepEqual(readFileSync(join(output,file)),readFileSync(join(source,file)),file);
  assert.equal(readFileSync(join(output,'.nojekyll'),'utf8'),'');
  const html=readFileSync(join(output,'index.html'),'utf8');
  assert.equal((html.match(/class="slide(?: |")/g)||[]).length,14);assert.equal((html.match(/<blockquote>/g)||[]).length,2);
  for(const [,file]of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)){
    assert.ok(timelineFiles.includes(file),file);
    assert.equal(new URL(file,'https://example.github.io/nas_dashboard/').pathname,'/nas_dashboard/'+file);
  }
  assert.doesNotMatch(html,/\/timeline\/|\/api\/|authjs|DashboardSidebar/);
}));

test('Pages packaging rejects unreviewed/private sources and incomplete story before writing output',()=>fixture(directory=>{
  const copy=join(directory,'source');cpSync(source,copy,{recursive:true});
  for(const file of ['.env.local','dashboard.sqlite','collections.md']){
    writeFileSync(join(copy,file),'synthetic private fixture');
    assert.throws(()=>buildTimelinePages(join(directory,'output'),copy),/Unexpected timeline file/);
    assert.equal(existsSync(join(directory,'output')),false);rmSync(join(copy,file));
  }
  mkdirSync(join(copy,'private'));
  assert.throws(()=>buildTimelinePages(join(directory,'output'),copy),/Unexpected timeline directory/);rmSync(join(copy,'private'),{recursive:true});
  const assets=join(directory,'reviewed-assets');renameSync(join(copy,'assets'),assets);
  symlinkSync(assets,join(copy,'assets'),'junction');
  assert.throws(()=>buildTimelinePages(join(directory,'output'),copy),/symlinks are forbidden/);
  assert.equal(existsSync(join(directory,'output')),false);
  unlinkSync(join(copy,'assets'));renameSync(assets,join(copy,'assets'));
  rmSync(join(copy,'assets','brand-w-modules.svg'));
  assert.throws(()=>buildTimelinePages(join(directory,'output'),copy),/incomplete/);
  assert.equal(existsSync(join(directory,'output')),false);
}));

test('Pages packaging refuses an existing destination rather than publishing stale files',()=>fixture(directory=>{
  const output=join(directory,'site');mkdirSync(output);writeFileSync(join(output,'private.txt'),'keep');
  assert.throws(()=>buildTimelinePages(output));assert.equal(readFileSync(join(output,'private.txt'),'utf8'),'keep');
  assert.deepEqual(readdirSync(output),['private.txt']);
}));

test('only main can deploy the narrow Pages artifact; the NAS has no timeline routes or adapter',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/timeline-pages.yml',import.meta.url),'utf8');
  assert.match(workflow,/branches: \[main\]/);assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/path: \.timeline-pages/);assert.match(workflow,/needs: build/);
  assert.match(workflow,/node --experimental-strip-types --test docs\/history-site\.test\.mjs tests\/timeline-pages\.test\.ts/);
  assert.match(workflow,/pages: write/);assert.match(workflow,/id-token: write/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/npm (?:ci|install|run build)|\.env|secrets\./);
  for(const file of ['app/timeline/route.ts','app/timeline/[...asset]/route.ts','lib/timeline-site.ts'])assert.equal(existsSync(new URL('../'+file,import.meta.url)),false,file);
  assert.doesNotMatch(readFileSync(new URL('../next.config.ts',import.meta.url),'utf8'),/timeline|github\.io/);
});
