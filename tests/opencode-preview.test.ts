import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,link} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {publishOpenCodePreview,listOpenCodePreviews,openCodePreviewResponse} from '../lib/opencode-preview.ts';
test('explicit preview snapshots have opaque IDs, exact bytes/hash, no-store and isolated network-free HTML',async()=>{
  const parent=join(process.cwd(),'.runtime/research');await mkdir(parent,{recursive:true});const dir=await mkdtemp(join(parent,'preview-test-')),root=join(dir,'store'),source=join(dir,'demo.html');
  try{await writeFile(source,'<!doctype html><h1>Demo</h1><script>console.log("local")</script>');const item=await publishOpenCodePreview(source,'Demo',root);assert.match(item.id,/^[a-f0-9]{32}$/);assert.equal((await listOpenCodePreviews(root)).length,1);const response=await openCodePreviewResponse(item.id,root);assert.equal(response.status,200);assert.equal(await response.text(),await readFile(source,'utf8'));assert.equal(response.headers.get('cache-control'),'private, no-store');const csp=response.headers.get('content-security-policy')!;assert.match(csp,/sandbox;/);assert.match(csp,/script-src 'none'/);assert.match(csp,/connect-src 'none'/);assert.doesNotMatch(csp,/allow-same-origin|allow-top-navigation/);assert.equal((await openCodePreviewResponse('../secret',root)).status,404);await writeFile(join(root,item.id+'.blob'),'tampered');await assert.rejects(()=>openCodePreviewResponse(item.id,root),/sérült/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('preview publication rejects unsupported, linked, oversized and private configuration files',async()=>{
  const parent=join(process.cwd(),'.runtime/research');await mkdir(parent,{recursive:true});const dir=await mkdtemp(join(parent,'preview-test-')),root=join(dir,'store');try{for(const file of ['x.exe','.env.local']){await writeFile(join(dir,file),'bytes');await assert.rejects(()=>publishOpenCodePreview(join(dir,file),'Demo',root));}const file=join(dir,'x.txt');await writeFile(file,'safe');await link(file,join(dir,'linked'));await assert.rejects(()=>publishOpenCodePreview(file,'Demo',root));await rm(join(dir,'linked'));await writeFile(file,Buffer.alloc(8*1024*1024+1));await assert.rejects(()=>publishOpenCodePreview(file,'Demo',root));assert.deepEqual(await listOpenCodePreviews(root),[]);}finally{await rm(dir,{recursive:true,force:true});}
});
test('every preview route checks authenticated admin owner before reading snapshots; no arbitrary filesystem route',()=>{
  for(const file of ['app/api/opencode/previews/route.ts','app/api/opencode/previews/[id]/route.ts']){const code=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.match(code,/await requireUser\(\)/);assert.match(code,/session.role!=='admin'/);assert.match(code,/isOpenCodeOwner/);assert.ok(code.indexOf('if(!session')<code.indexOf('try{'));assert.doesNotMatch(code,/searchParams|request\.json/);}
});
test('Next global headers keep the preview sandbox and permit only same-origin embedding on the exact owner endpoint',()=>{
  const config=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');assert.match(config,/source:'\/api\/opencode\/previews\/:id'/);assert.match(config,/key:'X-Frame-Options',value:'SAMEORIGIN'/);assert.match(config,/key:'Content-Security-Policy',value:OPENCODE_PREVIEW_CSP/);assert.match(config,/key: "X-Frame-Options", value: "DENY"/);
});
