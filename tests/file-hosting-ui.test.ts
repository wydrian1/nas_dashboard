import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {load} from 'cheerio';
const require=createRequire(import.meta.url),source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function manager(){const output=ts.transpileModule(source('app/files/file-manager.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports:Record<string,unknown>={};new Function('require','exports',output)((name:string)=>name==='@/lib/file-hosting/types'?require('../lib/file-hosting/types.ts'):require(name),exports);return exports.default as React.ComponentType<any>;}
test('hosting manager exposes folder/upload forms, immutable file handling, progress/cancel code and limited signed-link controls',()=>{
  const Manager=manager(),file={id:'a'.repeat(32),parent_id:null,name:'Photo.png',kind:'file',state:'ready',size:100,sha256:'b'.repeat(64),created_at:Date.now()},folder={...file,id:'c'.repeat(32),name:'Docs',kind:'folder',size:0};
  const page=load(renderToStaticMarkup(React.createElement(Manager,{initial:{folder:null,breadcrumbs:[],entries:[file,folder],links:[{id:'d'.repeat(64),file_id:file.id,expires_at:null,revoked_at:null,created_at:Date.now(),url:'/s/synthetic-token'}],maxFileBytes:1_000_000_000}})));
  assert.equal(page('input[type="file"][multiple][required]').length,1);assert.equal(page('form').length,2);assert.equal(page('.files-table tbody tr').length,2);assert.equal(page('a[href="/files?folder='+folder.id+'"]').length,1);assert.equal(page('a[href="/api/files/'+file.id+'/download"]').length,1);assert.equal(page('input[aria-label="Megosztási link"][readonly]').length,1);assert.match(page.text(),/Állandó|Visszavonás|Link létrehozása/);
  assert.match(source('app/files/file-manager.tsx'),/request\.send\(file\)/);assert.doesNotMatch(source('app/files/file-manager.tsx'),/readAsArrayBuffer|arrayBuffer\(|base64/);assert.match(source('app/files/file-manager.tsx'),/xhr\.current\?\.abort/);
});
test('admin guards precede private hosting reads/body reads; only the signed download route is public and CSRF is checked on all writes',()=>{
  const page=source('app/files/page.tsx');assert.ok(page.indexOf("if(session.role!=='admin')")<page.indexOf('listing(db()'));assert.match(source('app/dashboard-sidebar.tsx'),/href="\/files"/);
  for(const route of ['app/api/files/route.ts','app/api/files/upload/route.ts','app/api/files/folders/route.ts','app/api/files/links/route.ts','app/api/files/[id]/download/route.ts']){const code=source(route);assert.ok(code.indexOf('await requireAdmin()')<code.indexOf('db()'),route);assert.match(code,/authError/);}
  for(const route of ['upload','folders','links'])assert.match(source('app/api/files/'+route+'/route.ts'),/hostingWriteOrigin\(request\)/);
  assert.doesNotMatch(source('app/api/files/upload/route.ts'),/formData\(|arrayBuffer\(|\.text\(/);
  const publicRoute=source('app/s/[token]/route.ts');assert.match(publicRoute,/resolveHostingLink/);assert.match(publicRoute,/hostingDownload/);assert.doesNotMatch(publicRoute,/requireUser|listing|createHostingLink|readdir/);
});
