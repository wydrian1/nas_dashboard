import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readTravelItinerary,TRAVEL_CSP,TRAVEL_HEADERS,TRAVEL_SANDBOX,TRAVEL_HTML_LIMIT} from '../lib/travel.ts';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function temporary(){const parent=resolve('.runtime','travel-tests');mkdirSync(parent,{recursive:true});return mkdtempSync(join(parent,'case-'));}
test('Travel reads only the fixed private itinerary, preserves HTML bytes and handles missing/oversized data',()=>{
  const root=temporary();try{
    assert.equal(readTravelItinerary(root),null);
    const document='<!doctype html><html lang="hu"><style>h1{color:olive}</style><h1>Útiterv</h1><img src="https://example.org/photo.jpg"></html>';
    writeFileSync(join(root,'itinerary.html'),document);assert.equal(readTravelItinerary(root),document);
    writeFileSync(join(root,'itinerary.html'),Buffer.alloc(TRAVEL_HTML_LIMIT+1));assert.throws(()=>readTravelItinerary(root),/túl nagy/);
    rmSync(join(root,'itinerary.html'));mkdirSync(join(root,'itinerary.html'));assert.throws(()=>readTravelItinerary(root),/nem olvasható/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('Travel HTML is no-store, nonindexable and script-free with CSS/images and separate-tab links allowed',()=>{
  assert.equal(TRAVEL_HEADERS['Cache-Control'],'private, no-store');assert.equal(TRAVEL_HEADERS['Content-Type'],'text/html; charset=utf-8');assert.equal(TRAVEL_HEADERS['X-Frame-Options'],'SAMEORIGIN');assert.equal(TRAVEL_HEADERS['Referrer-Policy'],'no-referrer');assert.match(TRAVEL_HEADERS['X-Robots-Tag'],/noindex/);
  for(const directive of ["default-src 'none'","script-src 'none'","connect-src 'none'","form-action 'none'","base-uri 'none'","frame-ancestors 'self'","style-src 'unsafe-inline'",'img-src https: data:'])assert.ok(TRAVEL_CSP.includes(directive));
  assert.ok(TRAVEL_CSP.includes('sandbox '+TRAVEL_SANDBOX));assert.doesNotMatch(TRAVEL_SANDBOX,/allow-same-origin|allow-scripts|allow-forms|allow-top-navigation/);
});
test('Travel page and document enforce admin access before reading private data; sidebar and framing exceptions are narrow',()=>{
  const page=source('app/travel/page.tsx'),route=source('app/api/travel/itinerary/route.ts'),sidebar=source('app/dashboard-sidebar.tsx'),config=source('next.config.ts');
  assert.ok(page.indexOf("if(session.role!=='admin')")<page.indexOf('const available=readTravelItinerary()'));assert.match(page,/await requireUser\(\)/);assert.match(page,/sandbox=\{TRAVEL_SANDBOX\}/);assert.match(page,/referrerPolicy="no-referrer"/);
  assert.ok(route.indexOf('await requireAdmin()')<route.indexOf('const document=readTravelItinerary()'));assert.match(route,/return authError\(error\)/);assert.match(route,/status:404/);assert.match(route,/status:500/);assert.doesNotMatch(route,/searchParams|request\.json|params/);
  assert.match(sidebar,/role==='admin'[\s\S]*href="\/travel"[\s\S]*Utazás/);assert.match(config,/source:'\/api\/travel\/itinerary'/);assert.match(config,/value:TRAVEL_CSP/);assert.match(config,/key: "X-Frame-Options", value: "DENY"/);assert.match(config,/\.\/data\/\*\*\/\*/);assert.match(source('.gitignore'),/^data\//m);
});
test('Travel import preserves the original, verifies exact bytes, refuses overwrite and rejects non-HTML input',()=>{
  const root=temporary(),script=fileURLToPath(new URL('../scripts/Import-Travel-Itinerary.mjs',import.meta.url));try{
    const original=join(root,'source.html'),document='<!doctype html><html><h1>Privát tesztútiterv</h1></html>';
    writeFileSync(original,document);
    const result=JSON.parse(execFileSync(process.execPath,['--experimental-strip-types',script,original],{cwd:root,encoding:'utf8'}));assert.equal(result.imported,true);
    const saved=join(root,'data','travel','itinerary.html');assert.equal(readFileSync(saved,'utf8'),document);assert.equal(readFileSync(original,'utf8'),document);assert.equal(readTravelItinerary(join(root,'data','travel')),document);
    assert.throws(()=>execFileSync(process.execPath,['--experimental-strip-types',script,original],{cwd:root,stdio:'pipe'}));assert.equal(readFileSync(saved,'utf8'),document);
    rmSync(saved);writeFileSync(original,'not html');assert.throws(()=>execFileSync(process.execPath,['--experimental-strip-types',script,original],{cwd:root,stdio:'pipe'}));assert.equal(existsSync(saved),false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
