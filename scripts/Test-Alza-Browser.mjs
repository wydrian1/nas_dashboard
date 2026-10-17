// Production DOM reader exercised in Chromium, entirely fulfilled synthetic traffic.
// No shop/NAS requests, database, cookies, credentials, phones or notifications.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {readAlzaDocument,alzaResourceAllowed} from '../lib/pokemon/alza-browser.ts';
import {scanAlza,parseAlzaPage} from '../lib/pokemon/adapters/alza.ts';
import {ShopRequestError} from '../lib/pokemon/fetch-policy.ts';
import {ALZA_URL} from '../lib/pokemon/types.ts';

const fixture=readFileSync(new URL('../tests/fixtures/pokemon/alza/catalog.html',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});let checks=0,contextsClosed=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
async function session({html=fixture,status=200,headers={}}={}){
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  const requests=[],blocked=[];
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({path:url.pathname,method:request.method(),type:request.resourceType()});
    if(!alzaResourceAllowed(url.href,request.method(),request.resourceType())){blocked.push(url.pathname);return route.abort();}
    if(request.resourceType()==='document')return route.fulfill({status,headers,contentType:'text/html; charset=utf-8',body:html});
    return route.fulfill({status:200,contentType:'text/plain',body:''});
  });
  const page=await context.newPage();
  return {page,requests,blocked,read:input=>readAlzaDocument(page,input,AbortSignal.timeout(20_000)),close:async()=>{contextsClosed++;await context.close();}};
}
try{
  const normal=await session();
  try{
    const doc=await normal.read(ALZA_URL);check(doc.cartVisibility['1001']&&doc.cartVisibility['1002'],'both real rendered cart buttons visible');
    check(parseAlzaPage(doc.html,doc.url).products.length===2,'production reader output satisfies production parser');
    check(parseAlzaPage(doc.html,doc.url).products[0].image==='https://image.alza.cz/products/DEMO/DEMO.jpg','rendered thumbnail dimensions normalize to the original image URL');
    check(normal.requests.filter(request=>request.path.endsWith('.htm')).length===1,'one catalog visit, no retry or pagination');
  }finally{await normal.close();}
  for(const css of ['display:none','visibility:hidden','opacity:0']){
    const hidden=await session({html:fixture.replace('</head>',`<style>[data-id="1002"]{${css}}</style></head>`)});
    try{const doc=await hidden.read(ALZA_URL);check(doc.cartVisibility['1001']&&!doc.cartVisibility['1002'],'computed CSS visibility '+css);}finally{await hidden.close();}
  }
  let closed=false;const full=await session();
  const result=await scanAlza(AbortSignal.timeout(25_000),{open:async()=>({...full,close:async()=>{closed=true;await full.close();}})});
  check(result.total===2&&result.pages===1,'scanner proves a complete stock list through actual browser');check(closed,'scanner closes its browser session on success');
  check(result.products[0].image==='https://image.alza.cz/products/DEMO/DEMO.jpg','scanner retains the image through the complete browser/parser path');
  check(full.requests.every(request=>!request.path.endsWith('robots.txt')),'Alza does not request robots per explicit owner instruction');
  for(const [status,kind]of [[403,'protected'],[429,'rate_limited']]){
    const rejected=await session({status,headers:{'retry-after':'900'}});
    try{await assert.rejects(rejected.read(ALZA_URL),error=>error instanceof ShopRequestError&&error.kind===kind&&error.retryAfterMs===900000);checks++;check(rejected.requests.filter(request=>request.type==='document').length===1,'HTTP rejection never retries');}finally{await rejected.close();}
  }
  const challenge=await session({html:'<html><head><title>Security check</title></head><body>Verify you are human. CAPTCHA</body></html>'});
  try{const doc=await challenge.read(ALZA_URL);assert.throws(()=>parseAlzaPage(doc.html,doc.url),error=>error instanceof ShopRequestError&&error.kind==='protected');checks++;check(challenge.requests.filter(request=>request.type==='document').length===1,'challenge is observed without solving or retries');}finally{await challenge.close();}
  const hostile=await session({html:fixture.replace('</head>','<script>fetch("https://m.alza.hu/kosar",{method:"POST"}).catch(()=>{});fetch("http://127.0.0.1:8081/private").catch(()=>{});</script></head>')});
  try{await hostile.read(ALZA_URL);check(hostile.blocked.includes('/kosar')&&hostile.blocked.includes('/private'),'writes and private network requests blocked before any network access');}finally{await hostile.close();}
  console.log(JSON.stringify({passed:true,checks,contextsClosed,syntheticOnly:true,noExternalRequests:true,noDatabase:true,noNotifications:true}));
}finally{await browser.close();}
