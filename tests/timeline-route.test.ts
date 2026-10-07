import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {timelineAssets,timelineResponse} from '../lib/timeline-site.ts';

test('public timeline HTML is standalone, has canonical local assets and does not use the authenticated dashboard shell',async()=>{
  const response=timelineResponse(),html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8');
  assert.match(html,/lang="hu"/);assert.match(html,/src="\/timeline\/presentation\.js"/);assert.match(html,/href="\/timeline\/style\.css"/);
  assert.equal((html.match(/class="slide(?: |")/g)||[]).length,14);assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(html,/\/api\/|authjs|\/finance"|\/collections"|DashboardSidebar/);
});
test('timeline asset allowlist matches exactly the reviewed illustrations and code; responses use the correct MIME',async()=>{
  assert.equal(timelineAssets.length,11);assert.equal(new Set(timelineAssets).size,11);
  const images=readdirSync(new URL('../docs/history-site/assets/',import.meta.url)).map(file=>'assets/'+file);
  assert.deepEqual(timelineAssets.filter(file=>file.startsWith('assets/')).sort(),images.sort());
  for(const file of timelineAssets){const response=timelineResponse(file);assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>0);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('content-type'),file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');}
});
test('unknown assets, traversal, private files and other documentation are not publishable',()=>{
  for(const file of ['../collections.md','../.env.local','../../data/dashboard.sqlite','assets/../../.env.local','assets\\mark.svg','assets/missing.svg','%2e%2e/.env.local','C:\\Windows\\win.ini','/style.css','.nojekyll'])assert.equal(timelineResponse(file).status,404,file);
});
test('timeline routes are build-time static with a closed parameter list and no authentication or data access',()=>{
  for(const file of ['app/timeline/route.ts','app/timeline/[...asset]/route.ts']){
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.match(source,/dynamic='force-static'/);assert.doesNotMatch(source,/requireUser|requireAdmin|auth\(|cookies\(|headers\(|db\(/);
    if(file.includes('[...asset]')){assert.match(source,/dynamicParams=false/);assert.match(source,/generateStaticParams/);assert.match(source,/timelineAssets\.map/);}
  }
});
