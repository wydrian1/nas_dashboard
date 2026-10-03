import { createHmac,randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import { AccessError } from '../users.ts';
import { ADMIN_TARGETS,DASHBOARD_ORIGIN,type AdminTarget } from './policy.ts';
export { ADMIN_TARGETS,DASHBOARD_ORIGIN,HELPER_ORIGIN,type AdminTarget,type HelperJob,type HelperStatus } from './policy.ts';
export function adminTarget(value:unknown):AdminTarget {
  if(typeof value!=='string' || !ADMIN_TARGETS.some(target=>target.id===value))throw new AccessError('Nem engedélyezett szolgáltatás.',400);
  return value as AdminTarget;
}
export function helperId(value:unknown):string {if(typeof value!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(value))throw new AccessError('Érvénytelen kérésazonosító.',400);return value;}
export function helperHeaders(method:string,path:string,body:string,key:string,role:'control'|'request',now=Date.now(),nonce=randomBytes(32).toString('base64url')) {
  const bytes=Buffer.from(key,'base64');if(bytes.length!==32 || bytes.toString('base64')!==key)throw new Error('Invalid helper credential');
  const timestamp=Math.floor(now/1000).toString(),digest=createHash('sha256').update(body).digest('hex');
  const signature=createHmac('sha256',bytes).update(`${role}\n${method}\n${path}\n${timestamp}\n${nonce}\n${digest}`).digest('hex');
  return {'Content-Type':'application/json','X-Nas-Role':role,'X-Nas-Time':timestamp,'X-Nas-Nonce':nonce,'X-Nas-Signature':signature};
}
export function helperResponseSignature(status:number,body:string,key:string,role:'control'|'request',nonce:string) {
  const digest=createHash('sha256').update(body).digest('hex');
  return createHmac('sha256',Buffer.from(key,'base64')).update(`response\n${role}\n${nonce}\n${status}\n${digest}`).digest('hex');
}
export function verifyHelperResponse(status:number,body:string,key:string,role:'control'|'request',nonce:string,signature:string|null) {
  if(!signature || !/^[a-f0-9]{64}$/.test(signature))return false;
  return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(helperResponseSignature(status,body,key,role,nonce),'hex'));
}
export async function adminBody(request:Request):Promise<Record<string,unknown>> {
  if(request.headers.get('origin')!==DASHBOARD_ORIGIN || request.headers.get('sec-fetch-site')==='cross-site')throw new AccessError('Nem engedélyezett eredet.');
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json' || Number(request.headers.get('content-length')||0)>1024)throw new AccessError('Érvénytelen kérés.',400);
  const reader=request.body?.getReader();if(!reader)throw new AccessError('Üres kérés.',400);
  let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){await reader.cancel();throw new AccessError('Túl nagy kérés.',413);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccessError('Érvénytelen JSON.',400);}
  if(!body || typeof body!=='object' || Array.isArray(body))throw new AccessError('Érvénytelen kérés.',400);
  const data=body as Record<string,unknown>,action=data.action;
  const keys=action==='request'?['action','target']:action==='review'||action==='cancel'?['action','id']:action==='confirm'?['action','id','confirmation']:[];
  if(!keys.length || Object.keys(data).length!==keys.length || keys.some(key=>!(key in data)))throw new AccessError('Nem engedélyezett művelet vagy mező.',400);
  if(action==='request')adminTarget(data.target);else helperId(data.id);
  if(action==='confirm' && (typeof data.confirmation!=='string' || !ADMIN_TARGETS.some(target=>target.service===data.confirmation)))throw new AccessError('Írd be pontosan a szolgáltatás nevét.',400);
  return data;
}
