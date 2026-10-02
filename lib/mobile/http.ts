import { encode } from 'next-auth/jwt';
import { MOBILE_ORIGIN, MobileError, type MobileDevice } from './store.ts';
import type { Role } from '../users.ts';

export const mobileHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
export function mobileError(error:unknown) {
  return Response.json({error:error instanceof MobileError ? error.message : 'A kérés nem sikerült.'},{status:error instanceof MobileError ? error.status : 500,headers:mobileHeaders});
}
export async function mobileBody(request:Request):Promise<Record<string,unknown>> {
  const origin=request.headers.get('origin');
  if(origin && origin!==MOBILE_ORIGIN)throw new MobileError('Nem engedélyezett eredet.',403);
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json' || Number(request.headers.get('content-length') || 0)>8192)throw new MobileError('Érvénytelen kérés.');
  const reader=request.body?.getReader();if(!reader)throw new MobileError('Üres kérés.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8192){await reader.cancel();throw new MobileError('Túl nagy kérés.');}chunks.push(part.value);}}finally{reader.releaseLock();}
  try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value || typeof value!=='object' || Array.isArray(value))throw new Error();return value;}catch{throw new MobileError('Érvénytelen JSON.');}
}
export function bearer(request:Request) {return request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];}
export async function sessionResponse(device:MobileDevice,role:Role,body:Record<string,unknown>={}) {
  const secret=process.env.AUTH_SECRET;if(!secret)throw new Error('Auth secret missing.');
  const cookie='__Secure-authjs.session-token',maxAge=Math.min(12*60*60,Math.floor((device.expires_at-Date.now())/1000));
  const jwt=await encode({secret,salt:cookie,maxAge,token:{sub:device.id,email:device.email,name:device.label,mobileDeviceId:device.id}});
  return Response.json({...body,role,home:role==='pokemon-reader' ? '/pokemon' : '/',expiresAt:device.expires_at},{headers:{...mobileHeaders,'Set-Cookie':`${cookie}=${jwt}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`}});
}
