// Manual, one-visit diagnostic only. Not imported by the worker or dashboard.
// Fresh default Chromium context: no stealth, UA overrides, proxies or saved cookies.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const runtime=new URL('../.runtime/alza-probe/',import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH=fileURLToPath(new URL('browsers/',runtime));
const {chromium}=createRequire(new URL('package.json',runtime))('playwright');
const target='https://www.alza.hu/jatekok/pokemon-kartyak/18879069.htm#f&availabilityFilterValue=2&cud=0&pg=1&prod=';
const result={time:new Date().toISOString(),browser:'bundled Chromium',headless:true,freshContext:true,
  categoryVisits:0,status:'failed',documentStatus:null,title:null,reason:null,filterConfirmed:false,products:[],catalogResponses:[]};
let browser;
let deadline;
let expired=false;
try {
  browser=await chromium.launch({headless:true,timeout:30_000});
  deadline=setTimeout(()=>{expired=true;void browser.close().catch(()=>{});},60_000);
  const context=await browser.newContext();
  const page=await context.newPage();
  let rejected=false;
  page.on('response',response=>{
    const url=new URL(response.url());
    const mainDocument=response.request().isNavigationRequest() && response.frame()===page.mainFrame();
    const catalogFilter=url.origin==='https://www.alza.hu' && url.pathname==='/Services/EShopService.svc/Filter';
    if(mainDocument)result.documentStatus=response.status();
    if(catalogFilter){
      result.catalogResponses.push({path:url.pathname,status:response.status()});
    }
    if((mainDocument || catalogFilter) && response.status()>=400){
      rejected=true;result.status='blocked';result.reason=`Category or filter returned HTTP ${response.status()}. No retry performed.`;
      void page.close().catch(()=>{});
    }
  });
  result.categoryVisits++;
  const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30_000});
  result.documentStatus=response?.status() ?? null;
  result.title=await page.title();
  if(!response || response.status()>=400){
    result.status='blocked';result.reason=`Category document returned HTTP ${result.documentStatus ?? 'unknown'}. No retry performed.`;
  } else {
    await page.waitForFunction(()=>{
      const text=(document.title+' '+(document.body?.innerText || '').slice(0,5000)).toLowerCase();
      const challenge=/just a moment|access denied|verify you are human|checking your browser|captcha|hozzáférés megtagadva|robot vagy|biztonsági ellenőrzés/.test(text);
      const selected=Array.from(document.querySelectorAll('input[type="radio"]')).some(input=>input.value==='2'&&input.checked);
      const count=document.querySelector('#lblNumberItem')?.textContent?.trim();
      return challenge || (selected && /^\d+$/.test(count || '') && (Number(count)===0 || document.querySelector('#boxes .box[data-id]')));
    },undefined,{timeout:20_000});
    const snapshot=await page.evaluate(()=>{
      const normalize=text=>(text || '').replace(/\s+/g,' ').trim();
      const text=(document.title+' '+(document.body?.innerText || '').slice(0,5000)).toLowerCase();
      return {
        challenge:/just a moment|access denied|verify you are human|checking your browser|captcha|hozzáférés megtagadva|robot vagy|biztonsági ellenőrzés/.test(text),
        heading:normalize(document.querySelector('h1')?.textContent),
        filterConfirmed:Array.from(document.querySelectorAll('input[type="radio"]')).some(input=>input.value==='2'&&input.checked),
        total:Number(normalize(document.querySelector('#lblNumberItem')?.textContent)),
        currentPage:normalize(document.querySelector('#pagerbottom a[aria-current="page"]')?.textContent),
        products:Array.from(document.querySelectorAll('#boxes .box[data-id]')).map(card=>{
          const button=card.querySelector('a.btnk1');
          const visible=!!button && button.getClientRects().length>0 && getComputedStyle(button).visibility!=='hidden';
          return {id:card.getAttribute('data-id'),sku:card.getAttribute('data-code'),title:normalize(card.querySelector('a.name')?.textContent),
            url:card.querySelector('a.name')?.getAttribute('href'),price:normalize(card.querySelector('.js-price-box__primary-price__value')?.textContent),
            cartActive:visible && /kosárba/i.test(normalize(button.textContent)) && !button.matches('.disabled,[disabled],[aria-disabled="true"]'),
            stock:normalize(card.querySelector('.avl .avlVal')?.textContent)};
        })
      };
    });
    if(rejected || snapshot.challenge){result.status='blocked';result.reason='Catalog rejection or bot/CAPTCHA check detected. No interaction or retry performed.';}
    else if(!snapshot.filterConfirmed || !/pok[eé]mon/i.test(snapshot.heading))result.reason='The requested filtered Pokemon category could not be confirmed.';
    else if(snapshot.currentPage!=='1' || snapshot.total!==snapshot.products.length){result.status='partial';result.reason='The first page is not a confirmed complete catalog. Pagination was not attempted in this one-visit probe.';}
    else {
      const safe=snapshot.products.every(product=>{
        if(!/^\d+$/.test(product.id || '') || !product.title || !product.url)return false;
        const url=new URL(product.url,'https://www.alza.hu');
        return url.origin==='https://www.alza.hu' && !url.username && !url.password && url.pathname.endsWith(`-d${product.id}.htm`);
      });
      if(!safe || new Set(snapshot.products.map(product=>product.id)).size!==snapshot.products.length)result.reason='Product identity or canonical link validation failed.';
      else {
        result.status='success';result.filterConfirmed=true;
        result.products=snapshot.products.map(product=>({...product,url:new URL(product.url,'https://www.alza.hu').href}));
        result.reason='One complete filtered page observed. This is not permission or a reliability test for ongoing monitoring.';
      }
    }
  }
} catch(error) {
  if(result.status!=='blocked')result.reason=expired ? 'The one-visit probe reached its total time limit.' : error instanceof Error ? error.message.slice(0,600) : 'Probe failed.';
} finally {
  if(deadline)clearTimeout(deadline);
  if(browser)await browser.close().catch(()=>{});
  const folder=new URL('../.runtime/research/',import.meta.url);
  mkdirSync(folder,{recursive:true});
  writeFileSync(new URL('alza-playwright-probe.json',folder),JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify(result,null,2));
process.exitCode=result.status==='success' ? 0 : 2;
