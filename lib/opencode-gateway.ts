import http,{type IncomingMessage,type OutgoingHttpHeaders,type ServerResponse} from 'node:http';
import type { Socket } from 'node:net';
import { OPENCODE_ORIGIN,DASHBOARD_ORIGIN,accessCookieToken,OPENCODE_COOKIE } from './opencode-policy.ts';

type Upstream={url:string;password:string};
type GatewayOptions={dashboardUrl:string;upstream:()=>Upstream;recheckMs?:number};
const originHost=new URL(OPENCODE_ORIGIN).host;
const securityHeaders={
  'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',
  'content-security-policy':`frame-ancestors ${DASHBOARD_ORIGIN}; base-uri 'self'; object-src 'none'`,
};
export function checkGatewayRequest(request:IncomingMessage,upgrade=false):string {
  if(request.headers.host!==originHost)throw new Error('host');
  const raw=request.url || '/';
  if(!raw.startsWith('/') || raw.startsWith('//') || /[\\\x00-\x20]/.test(raw))throw new Error('path');
  const url=new URL(raw,OPENCODE_ORIGIN);let path:string;
  try{path=decodeURIComponent(url.pathname);}catch{throw new Error('path');}
  // Never publish native pairing/password login endpoints or bypass the dashboard lease.
  if(/[\\\x00-\x1f]/.test(path) || path.includes('//') || path.split('/').some(part=>part==='.' || part==='..') || /^\/auth(?:\/|$)/i.test(path) || /^\/api\/pair(?:\/|$)/i.test(path))throw new Error('pairing');
  if(request.headers['sec-fetch-site']==='cross-site')throw new Error('origin');
  const origin=request.headers.origin;
  if(origin && origin!==OPENCODE_ORIGIN)throw new Error('origin');
  if((upgrade || !['GET','HEAD'].includes(request.method || 'GET')) && origin!==OPENCODE_ORIGIN)throw new Error('origin');
  return url.pathname+url.search;
}
export function gatewayRequestHeaders(request:IncomingMessage,password:string,upstreamOrigin='http://127.0.0.1:49374'):OutgoingHttpHeaders {
  const headers:OutgoingHttpHeaders={...request.headers,host:new URL(upstreamOrigin).host,authorization:'Basic '+Buffer.from('opencode:'+password).toString('base64')};
  for(const name of ['cookie','proxy-authorization','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','x-nas-opencode-family'])delete headers[name];
  if(request.headers.upgrade!=='websocket'){
    for(const name of String(request.headers.connection || '').split(',').map(value=>value.trim().toLowerCase()))delete headers[name];
    delete headers.connection;delete headers.upgrade;
  }
  // Upstream CORS checks see its own loopback origin, not attacker-controlled headers.
  if(headers.origin)headers.origin=upstreamOrigin;
  delete headers.referer;
  return headers;
}
function responseHeaders(headers:http.IncomingHttpHeaders,upstream:string):OutgoingHttpHeaders {
  const filtered:OutgoingHttpHeaders={...headers,...securityHeaders};
  for(const name of ['set-cookie','www-authenticate','access-control-allow-origin','access-control-allow-credentials','x-frame-options','server'])delete filtered[name];
  if(typeof filtered.location==='string'){
    const redirect=new URL(filtered.location,upstream);
    if(redirect.origin!==new URL(upstream).origin || redirect.pathname.startsWith('/auth/'))delete filtered.location;
    else filtered.location=OPENCODE_ORIGIN+redirect.pathname+redirect.search+redirect.hash;
  }
  return filtered;
}
export function createOpenCodeGateway(options:GatewayOptions) {
  const dashboard=new URL(options.dashboardUrl);
  if(dashboard.protocol!=='http:' || dashboard.hostname!=='127.0.0.1')throw new Error('Dashboard must be loopback HTTP');
  async function authorized(request:IncomingMessage):Promise<number> {
    const token=accessCookieToken(request.headers.cookie || null);if(!token)return 401;
    try{
      const result=await fetch(new URL('/api/opencode/access',dashboard),{headers:{cookie:`${OPENCODE_COOKIE}=${token}`},redirect:'manual',signal:AbortSignal.timeout(5000)});
      await result.body?.cancel();return result.status===204 ? 204 : result.status===403 ? 403 : result.status===401 ? 401 : 503;
    }catch{return 503;}
  }
  function upstream() {
    const value=options.upstream(),url=new URL(value.url);
    if(url.protocol!=='http:' || url.hostname!=='127.0.0.1' || url.pathname!=='/' || url.search || url.hash || url.username || url.password || !value.password)throw new Error('Invalid OpenCode loopback service');
    return {...value,url};
  }
  function deny(response:ServerResponse,status:number) {
    response.writeHead(status,{...securityHeaders,'content-type':'text/html; charset=utf-8'});
    response.end(`<!doctype html><html lang="hu"><meta name="viewport" content="width=device-width"><title>OpenCode – védett hozzáférés</title><body style="font:16px system-ui;background:#11151b;color:#eee;padding:32px"><h1>OpenCode – védett hozzáférés</h1><p>${status===503 ? 'Az átjáró vagy a helyi OpenCode jelenleg nem érhető el.' : 'A hozzáférés hiányzik, lejárt vagy nem engedélyezett.'}</p><a style="color:#9cf" href="${DASHBOARD_ORIGIN}/opencode" target="_top">Megnyitás a dashboardból →</a></body></html>`);
  }
  const server=http.createServer(async(request,response)=>{
    let path:string;try{path=checkGatewayRequest(request);}catch{deny(response,403);return;}
    const status=await authorized(request);if(status!==204){deny(response,status);return;}
    let target:ReturnType<typeof upstream>;try{target=upstream();}catch{deny(response,503);return;}
    const proxy=http.request(new URL(path,target.url),{method:request.method,headers:gatewayRequestHeaders(request,target.password,target.url.origin)},remote=>{
      response.writeHead(remote.statusCode || 502,responseHeaders(remote.headers,target.url.origin));
      remote.pipe(response);remote.on('error',()=>response.destroy());
    });
    proxy.on('error',()=>{if(!response.headersSent)deny(response,503);else response.destroy();});
    proxy.setTimeout(30000,()=>proxy.destroy());
    const timer=setInterval(()=>{void authorized(request).then(status=>{if(status!==204){proxy.destroy();response.destroy();}});},options.recheckMs ?? 15000);timer.unref();
    response.on('close',()=>{clearInterval(timer);proxy.destroy();});request.on('aborted',()=>proxy.destroy());
    request.pipe(proxy);
  });
  server.on('upgrade',async(request,socket,head)=>{
    const denySocket=(status:number)=>{socket.end(`HTTP/1.1 ${status} Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);};
    let path:string;try{path=checkGatewayRequest(request,true);if(request.headers.upgrade!=='websocket')throw new Error('upgrade');}catch{denySocket(403);return;}
    const status=await authorized(request);if(status!==204){denySocket(status);return;}
    let target:ReturnType<typeof upstream>;try{target=upstream();}catch{denySocket(503);return;}
    const proxy=http.request(new URL(path,target.url),{headers:gatewayRequestHeaders(request,target.password,target.url.origin)});
    let peer:Socket|undefined;
    const timer=setInterval(()=>{void authorized(request).then(status=>{if(status!==204){proxy.destroy();peer?.destroy();socket.destroy();}});},options.recheckMs ?? 15000);timer.unref();
    socket.on('error',()=>peer?.destroy());socket.on('close',()=>{clearInterval(timer);proxy.destroy();peer?.destroy();});
    proxy.on('error',()=>socket.destroy());proxy.setTimeout(10000,()=>proxy.destroy());
    proxy.on('response',remote=>{remote.resume();denySocket(remote.statusCode || 502);});
    proxy.on('upgrade',(remote,remoteSocket,remoteHead)=>{
      peer=remoteSocket;proxy.setTimeout(0);
      const headers=responseHeaders(remote.headers,target.url.origin);
      socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(headers).filter(([,value])=>value!==undefined).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).map(item=>`${key}: ${item}\r\n`)).join('')+'\r\n');
      if(remoteHead.length)socket.write(remoteHead);if(head.length)remoteSocket.write(head);
      remoteSocket.pipe(socket);socket.pipe(remoteSocket);
      remoteSocket.on('error',()=>socket.destroy());remoteSocket.on('close',()=>socket.destroy());
    });proxy.end();
  });
  server.requestTimeout=60000;server.headersTimeout=15000;server.maxHeadersCount=100;
  return server;
}
