import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { encode,decode } from 'next-auth/jwt';
import http from 'node:http';
import { once } from 'node:events';
import { initializeDatabase } from '../lib/db-schema.ts';
import { ownerEmail } from '../lib/users.ts';
import { opaque,digest,startPair,approvePair,exchangePair,revokeDevice } from '../lib/mobile/store.ts';
import { OPENCODE_COOKIE,OPENCODE_ORIGIN,DASHBOARD_ORIGIN,accessCookieToken,checkOpenCodeLaunchOrigin,mintOpenCodeLease,verifyOpenCodeLease,revokeOpenCodeFamily,requireOpenCodeIdentity } from '../lib/opencode-access.ts';
import { checkGatewayRequest,gatewayRequestHeaders,createOpenCodeGateway } from '../lib/opencode-gateway.ts';
const secret='test-only-opencode-secret-never-used-in-production';
const parent=()=>({email:ownerEmail(),exp:Math.floor(Date.now()/1000)+3600});
function database(){const db=new DatabaseSync(':memory:');initializeDatabase(db);return db;}
function request(path='/',headers:Record<string,string>={},method='GET'){return {url:path,headers:{host:new URL(OPENCODE_ORIGIN).host,...headers},method} as http.IncomingMessage;}
test('OpenCode: only the owner qualifies, not other admins or readers',()=>{
  const db=database();try{
    for(const [email,role] of [['admin@example.com','admin'],['reader@example.com','pokemon-reader']])db.prepare('INSERT INTO dashboard_users VALUES(?,?,1,1,1)').run(email,role);
    assert.equal(requireOpenCodeIdentity(db,parent()).email,ownerEmail());
    for(const email of ['admin@example.com','reader@example.com','unknown@example.com'])assert.throws(()=>requireOpenCodeIdentity(db,{email}));
    assert.throws(()=>requireOpenCodeIdentity(db,{...parent(),mobileDeviceId:'forged'}));
  }finally{db.close();}
});
test('OpenCode: short encrypted HttpOnly lease, parent expiry, tampering and duplicate-cookie rejection',async()=>{
  const db=database();try{
    const cookie=await mintOpenCodeLease(db,parent(),secret),raw=accessCookieToken(cookie)!;
    assert.match(cookie,/Domain=nas\.wydrian\.hu; Path=\/; Max-Age=300; Secure; HttpOnly; SameSite=Lax/);
    assert.ok(!raw.includes(ownerEmail()));assert.equal((await verifyOpenCodeLease(db,cookie,secret)).email,ownerEmail());
    assert.equal(accessCookieToken(cookie+'; '+OPENCODE_COOKIE+'='+raw),null);
    await assert.rejects(verifyOpenCodeLease(db,OPENCODE_COOKIE+'='+raw.slice(0,-3)+'abc',secret));
    await assert.rejects(verifyOpenCodeLease(db,cookie,'wrong-secret'));
    await assert.rejects(mintOpenCodeLease(db,{...parent(),exp:1},secret));
    const short=await mintOpenCodeLease(db,{...parent(),exp:Math.floor(Date.now()/1000)+30},secret);
    assert.match(short,/Max-Age=30;/);
    const token=(await decode({token:raw,secret,salt:OPENCODE_COOKIE}))!;
    assert.equal(token.exp!-token.iat!,300);
    const expired=await encode({secret,salt:OPENCODE_COOKIE,maxAge:-1,token});
    await assert.rejects(verifyOpenCodeLease(db,OPENCODE_COOKIE+'='+expired,secret));
    const wrongPurpose=await encode({secret,salt:OPENCODE_COOKIE,maxAge:300,token:{...token,purpose:'other'}});
    await assert.rejects(verifyOpenCodeLease(db,OPENCODE_COOKIE+'='+wrongPurpose,secret));
  }finally{db.close();}
});
test('OpenCode: renewal retains the revocable family; logout invalidates older copies too',async()=>{
  const db=database();try{
    const first=await mintOpenCodeLease(db,parent(),secret),second=await mintOpenCodeLease(db,parent(),secret,first);
    assert.equal((await verifyOpenCodeLease(db,first,secret)).family,(await verifyOpenCodeLease(db,second,secret)).family);
    await revokeOpenCodeFamily(db,second,secret);
    await assert.rejects(verifyOpenCodeLease(db,first,secret));await assert.rejects(verifyOpenCodeLease(db,second,secret));
  }finally{db.close();}
});
test('OpenCode: revoking a paired owner phone immediately denies its lease',async()=>{
  const db=database();try{
    const verifier=opaque(),pair=startPair(db,digest(verifier),'OpenCode test phone');approvePair(db,pair.id,ownerEmail());
    const device=exchangePair(db,pair.id,verifier)!;
    const cookie=await mintOpenCodeLease(db,{...parent(),mobileDeviceId:device.deviceId},secret);
    assert.equal((await verifyOpenCodeLease(db,cookie,secret)).mobileDeviceId,device.deviceId);
    revokeDevice(db,device.deviceId);await assert.rejects(verifyOpenCodeLease(db,cookie,secret));
  }finally{db.close();}
});
test('OpenCode: launch and proxy origins, pairing endpoints, websocket and credential boundaries',()=>{
  checkOpenCodeLaunchOrigin(new Request(DASHBOARD_ORIGIN+'/api/opencode/connect',{method:'POST',headers:{origin:DASHBOARD_ORIGIN}}));
  for(const origin of ['',OPENCODE_ORIGIN,'https://evil.example'])assert.throws(()=>checkOpenCodeLaunchOrigin(new Request(DASHBOARD_ORIGIN,{method:'POST',headers:{origin}})));
  for(const path of ['//evil.example/','/auth/connect/code','/api/pair','/%61uth/login','/auth%2fconnect/x','/\\evil'])assert.throws(()=>checkGatewayRequest(request(path)));
  assert.throws(()=>checkGatewayRequest(request('/',{host:'evil.example'})));
  assert.throws(()=>checkGatewayRequest(request('/api/session',{},'POST')));
  assert.throws(()=>checkGatewayRequest(request('/api/pty/x/connect',{},'GET'),true));
  assert.throws(()=>checkGatewayRequest(request('/',{'sec-fetch-site':'cross-site'})));
  assert.equal(checkGatewayRequest(request('/api/session',{origin:OPENCODE_ORIGIN},'POST')),'/api/session');
  const headers=gatewayRequestHeaders(request('/',{cookie:'secret',authorization:'attacker',origin:OPENCODE_ORIGIN,'x-forwarded-host':'evil'}),'test-password');
  assert.equal(headers.cookie,undefined);assert.equal(headers['x-forwarded-host'],undefined);
  assert.equal(headers.authorization,'Basic '+Buffer.from('opencode:test-password').toString('base64'));
  assert.equal(headers.origin,'http://127.0.0.1:49374');
});
async function listen(server:http.Server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${(server.address() as {port:number}).port}`;}
function call(url:string,path:string,headers:Record<string,string>={},method='GET'):Promise<{status:number;headers:http.IncomingHttpHeaders;body:string}>{
  return new Promise((resolve,reject)=>{const req=http.request(url+path,{method,headers:{host:new URL(OPENCODE_ORIGIN).host,...headers}},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body}));});req.on('error',reject);req.end();});
}
test('OpenCode: real gateway denies before proxy, strips credentials/cookies, fails closed and streams',{timeout:10000},async()=>{
  let authStatus=204,hits=0;const seen:http.IncomingHttpHeaders[]=[];
  const dashboard=http.createServer((req,res)=>{assert.equal(req.url,'/api/opencode/access');res.writeHead(authStatus);res.end();});
  const upstream=http.createServer((req,res)=>{hits++;seen.push(req.headers);res.setHeader('set-cookie','native_opencode_password=forbidden');res.setHeader('www-authenticate','Basic');res.end(req.url==='/api/info'?'mock-info':'mock-ui');});
  const dashboardUrl=await listen(dashboard),upstreamUrl=await listen(upstream);
  const gateway=createOpenCodeGateway({dashboardUrl,upstream:()=>({url:upstreamUrl,password:'test-password'}),recheckMs:20}),url=await listen(gateway);
  const cookies={cookie:`${OPENCODE_COOKIE}=test.fake.token; __Secure-authjs.session-token=must-not-forward`};
  try{
    assert.equal((await call(url,'/')).status,401);assert.equal(hits,0);
    assert.equal((await call(url,'/api/pair',cookies)).status,403);assert.equal(hits,0);
    const result=await call(url,'/api/info',cookies);assert.equal(result.status,200);assert.equal(result.body,'mock-info');
    assert.equal(seen[0].cookie,undefined);assert.match(String(seen[0].authorization),/^Basic /);
    assert.equal(result.headers['set-cookie'],undefined);assert.equal(result.headers['www-authenticate'],undefined);
    assert.equal(result.headers['cache-control'],'no-store');assert.match(String(result.headers['content-security-policy']),/frame-ancestors https:\/\/nas.wydrian.hu/);
    for(const status of [401,403,500]){authStatus=status;assert.equal((await call(url,'/_assets/ui.js',cookies)).status,status===500?503:status);}
    assert.equal(hits,1);
    authStatus=204;upstream.removeAllListeners('request');upstream.on('request',(req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: hello\n\n');});
    await new Promise<void>((resolve,reject)=>{const req=http.request(url+'/api/event',{headers:{host:new URL(OPENCODE_ORIGIN).host,...cookies}},res=>{res.once('data',()=>{authStatus=401;});res.on('aborted',resolve);res.on('error',()=>{});});req.on('error',reject);req.end();});
  }finally{gateway.closeAllConnections();upstream.closeAllConnections();dashboard.closeAllConnections();await Promise.all([new Promise<void>(r=>gateway.close(()=>r())),new Promise<void>(r=>upstream.close(()=>r())),new Promise<void>(r=>dashboard.close(()=>r()))]);}
});
test('OpenCode: websocket upgrade/bytes proxy and revocation close the socket',{timeout:10000},async()=>{
  let authStatus=204;const dashboard=http.createServer((req,res)=>{res.writeHead(authStatus);res.end();});
  const peers=new Set<import('node:stream').Duplex>();
  let peerClosed!:()=>void;const peerClosure=new Promise<void>(resolve=>peerClosed=resolve);
  const upstream=http.createServer();upstream.on('upgrade',(req,socket,head)=>{
    assert.equal(req.headers.cookie,undefined);assert.equal(req.headers.origin,new URL(upstreamUrl).origin);
    assert.equal(req.headers.authorization,'Basic '+Buffer.from('opencode:test-password').toString('base64'));
    peers.add(socket);socket.on('close',()=>{peers.delete(socket);peerClosed();});socket.on('error',()=>{});socket.on('end',()=>socket.end());
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
    if(head.length)socket.write(head);socket.on('data',data=>socket.write(data));
  });
  const dashboardUrl=await listen(dashboard),upstreamUrl=await listen(upstream);
  const gateway=createOpenCodeGateway({dashboardUrl,upstream:()=>({url:upstreamUrl,password:'test-password'}),recheckMs:20}),url=await listen(gateway);
  try{
    await new Promise<void>((resolve,reject)=>{
      const req=http.request(url+'/api/pty/test/connect',{headers:{host:new URL(OPENCODE_ORIGIN).host,cookie:OPENCODE_COOKIE+'=test.fake.token',origin:OPENCODE_ORIGIN,connection:'Upgrade',upgrade:'websocket'}});
      req.on('error',reject);req.on('response',()=>reject(new Error('Websocket was not upgraded')));
      req.on('upgrade',(res,socket)=>{socket.on('error',()=>{});socket.once('data',data=>{assert.equal(data.toString(),'echo-test');authStatus=401;});socket.once('close',resolve);socket.write('echo-test');});req.end();
    });
    await peerClosure;assert.equal(peers.size,0);
  }finally{for(const peer of peers)peer.destroy();gateway.closeAllConnections();dashboard.closeAllConnections();await Promise.all([new Promise<void>(r=>gateway.close(()=>r())),new Promise<void>(r=>upstream.close(()=>r())),new Promise<void>(r=>dashboard.close(()=>r()))]);}
});
