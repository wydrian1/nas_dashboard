import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseBloomriftCredentials,readBloomriftCredentials,bloomriftSessionUrl,bloomriftMemberPage,createBloomriftMemberDownload,type BloomriftRequest} from '../lib/pokemon/bloomrift-session.ts';
import {parseBloomriftPage} from '../lib/pokemon/adapters/bloomrift.ts';
import {BLOOMRIFT_URL} from '../lib/pokemon/types.ts';
const credentials={username:'synthetic@example.test',password:'synthetic +&= password'},signal=new AbortController().signal;
const catalog=readFileSync(new URL('./fixtures/pokemon/bloomrift/catalog.html',import.meta.url),'utf8');
const login=`${catalog}<form method="post" action="https://bloomrift.eu/shop_logincheck.php"><input type="hidden" name="file_back" value="/Osszes-angol-termek"><input type="hidden" name="login_redir" value=""><input type="email" name="shop_user_login"><input type="password" name="shop_pass_login"></form>`;
const member=`${catalog}<a href="https://bloomrift.eu/shop_logout.php">Kilépés</a>`;
const noWait=async()=>{};
const response=(body:string,status=200,cookies:string[]=[],location?:string)=>({body,status,cookies,location});

test('Bloomrift credentials preserve password bytes, handle UTF-8 BOM/CRLF and reject malformed/oversized input without disclosure',()=>{
  assert.deepEqual(parseBloomriftCredentials('\uFEFF'+credentials.username+'\r\n'+credentials.password+'\r\n'),credentials);
  for(const text of ['',credentials.username,credentials.username+'\n',credentials.username+'\npass\nextra','wrong user\npass',credentials.username+'\npa\x00ss',credentials.username+'\n'+'p'.repeat(8192)])assert.throws(()=>parseBloomriftCredentials(text),error=>error instanceof Error&&!error.message.includes(credentials.username)&&!error.message.includes('extra'));
});
test('Bloomrift private file reads are bounded and explicit missing/invalid credentials fail closed',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'nas-bloomrift-key-')),file=join(directory,'synthetic.key'),previous=process.env.BLOOMRIFT_CREDENTIALS_FILE;
  try{
    process.env.BLOOMRIFT_CREDENTIALS_FILE=file;
    await assert.rejects(readBloomriftCredentials(),error=>error instanceof Error&&!error.message.includes(file));
    writeFileSync(file,credentials.username+'\n'+credentials.password);assert.deepEqual(await readBloomriftCredentials(),credentials);
    writeFileSync(file,'x'.repeat(9000));await assert.rejects(readBloomriftCredentials());
    process.env.BLOOMRIFT_CREDENTIALS_FILE=directory;await assert.rejects(readBloomriftCredentials());
  }finally{if(previous===undefined)delete process.env.BLOOMRIFT_CREDENTIALS_FILE;else process.env.BLOOMRIFT_CREDENTIALS_FILE=previous;rmSync(directory,{recursive:true,force:true});}
});
test('Bloomrift authenticated allowlist has one POST target and only category GETs; cart/products/logout/robots/foreign origins cannot receive secrets',()=>{
  assert.equal(bloomriftSessionUrl('https://bloomrift.eu/shop_logincheck.php','POST').pathname,'/shop_logincheck.php');
  assert.equal(bloomriftSessionUrl(BLOOMRIFT_URL+',2','GET').href,BLOOMRIFT_URL+',2');
  for(const url of [BLOOMRIFT_URL,'https://bloomrift.eu/shop_logincheck.php?x=1','https://evil.example/shop_logincheck.php','http://bloomrift.eu/shop_logincheck.php'])assert.throws(()=>bloomriftSessionUrl(url,'POST'));
  for(const url of ['https://bloomrift.eu/shop_logincheck.php','https://bloomrift.eu/shop_logout.php','https://bloomrift.eu/robots.txt','https://bloomrift.eu/shop_ajax/cart.php','https://bloomrift.eu/pokemon-demo','https://evil.example/Osszes-angol-termek',BLOOMRIFT_URL+'?sort=x'])assert.throws(()=>bloomriftSessionUrl(url,'GET'));
});
test('Bloomrift member proof rejects login forms, missing/duplicate logout and lingering member gates',()=>{
  assert.equal(bloomriftMemberPage(member),true);
  for(const html of [catalog,login,member+login,member+member,member+'<div class="not-buyable__text">regisztrált és bejelentkezett</div>'])assert.equal(bloomriftMemberPage(html),false);
});
test('Bloomrift session logs in once, correctly encodes secrets, uses bounded host/path cookies and keeps verified stock unchanged',async()=>{
  const calls:Parameters<BloomriftRequest>[0][]=[],waits:number[]=[];
  const download=createBloomriftMemberDownload(credentials,{delayMs:5000,wait:async ms=>{waits.push(ms);},request:async input=>{
    calls.push(input);
    if(calls.length===1)return response(login,200,['session=synthetic; Path=/; Secure; HttpOnly','other=not-for-category; Path=/other; Secure']);
    if(input.method==='POST')return response('',302,['member=synthetic-member; Domain=.bloomrift.eu; Path=/; Secure; HttpOnly'], '/Osszes-angol-termek?get=login_ok');
    return response(member);
  }});
  assert.equal(parseBloomriftPage(await download(BLOOMRIFT_URL,signal)).products.length,1);
  await download(BLOOMRIFT_URL+',2',signal);
  assert.deepEqual(calls.map(call=>[call.method,call.url]),[['GET',BLOOMRIFT_URL],['POST','https://bloomrift.eu/shop_logincheck.php'],['GET',BLOOMRIFT_URL],['GET',BLOOMRIFT_URL+',2']]);
  assert.equal(new URLSearchParams(calls[1].body).get('shop_pass_login'),credentials.password);
  assert.equal(calls[0].cookie,'');assert.equal(calls[1].cookie,'session=synthetic');assert.equal(calls[2].cookie,'session=synthetic; member=synthetic-member');
  assert.ok(waits.every(ms=>ms===5000));assert.equal(calls.filter(call=>call.body).length,1);
});
test('Bloomrift refuses unexpected login forms before posting credentials',async()=>{
  for(const html of [catalog,login.replace('method="post"','method="get"'),login.replace('/shop_logincheck.php','/shop_ajax/cart.php'),login.replace('value="/Osszes-angol-termek"','value="https://evil.example"'),login.replace('name="login_redir"','name="unknown"'),login.replace('type="email"','type="text"')]){
    let calls=0;const download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>{calls++;return response(html);}});
    await assert.rejects(download(BLOOMRIFT_URL,signal));assert.equal(calls,1);
  }
});
test('Bloomrift never follows unexpected redirects or publishes anonymous stock after login failure',async()=>{
  for(const result of [response('',302,[],'https://evil.example/steal'),response('',302,[],'/shop_ajax/cart.php'),response('',302,[],BLOOMRIFT_URL+'?token=private'),response('',302,[],BLOOMRIFT_URL+'?get=login_error'),response('',200),response('',403),response('',302)]){
    let calls=0;const download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>++calls===1?response(login):result});
    await assert.rejects(download(BLOOMRIFT_URL,signal));assert.equal(calls,2);
  }
  for(const result of [response(catalog),response(login),response(member,302,[],BLOOMRIFT_URL),response(member,429)]){
    let calls=0;const download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>++calls===1?response(login):calls===2?response('',302,[],BLOOMRIFT_URL):result});
    await assert.rejects(download(BLOOMRIFT_URL,signal));assert.equal(calls,3);
  }
});
test('Bloomrift session expiry clears cookies, fails the current scan and permits one clean login on the next scan',async()=>{
  let expired=false;const calls:Parameters<BloomriftRequest>[0][]=[],download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async input=>{
    calls.push(input);if(input.method==='POST')return response('',302,['session=synthetic; Path=/'],BLOOMRIFT_URL);
    if(!input.cookie)return response(login);
    return response(expired?login:member);
  }});
  await download(BLOOMRIFT_URL,signal);expired=true;await assert.rejects(download(BLOOMRIFT_URL+',2',signal));expired=false;
  await download(BLOOMRIFT_URL,signal);assert.equal(calls.filter(call=>call.method==='POST').length,2);assert.equal(calls[4].cookie,'');
});
test('Bloomrift member transport retains sanitized HTTP categories and Retry-After instead of misclassifying rate limits as login failures',async()=>{
  for(const [status,kind]of [[403,'protected'],[429,'rate_limited'],[503,'error']] as const){
    const download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>({...response('private upstream response',status),retryAfterMs:123000})});
    await assert.rejects(download(BLOOMRIFT_URL,signal),error=>!!error&&typeof error==='object'&&'kind' in error&&error.kind===kind&&'retryAfterMs' in error&&error.retryAfterMs===123000&&!String(error).includes('private upstream'));
  }
});
test('Bloomrift rejects foreign/unsafe/oversized cookies and sanitized transport exceptions never disclose secrets',async()=>{
  for(const cookie of ['session=synthetic; Domain=evil.example','session=bad\r\nheader','session='+ 'a'.repeat(8193),'bad name=value','session=value; Path=invalid']){
    let calls=0;const download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>{calls++;return response(login,200,[cookie]);}});
    await assert.rejects(download(BLOOMRIFT_URL,signal));assert.equal(calls,1);
  }
  const download=createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>{throw new Error(credentials.username+' '+credentials.password+' private-cookie');}});
  await assert.rejects(download(BLOOMRIFT_URL,signal),error=>error instanceof Error&&!error.message.includes(credentials.username)&&!error.message.includes(credentials.password)&&!error.message.includes('private-cookie'));
  const abort=new AbortController();abort.abort();let calls=0;
  await assert.rejects(createBloomriftMemberDownload(credentials,{wait:noWait,request:async()=>{calls++;return response(login);}})(BLOOMRIFT_URL,abort.signal));assert.equal(calls,0);
});
