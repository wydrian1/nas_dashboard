import { createHash } from 'node:crypto';
import { getToken } from 'next-auth/jwt';
import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { requireOpenCodeIdentity } from '@/lib/opencode-access';
import { AccessError } from '@/lib/users';
import { adminBody } from '@/lib/admin-helper/protocol';
import { HelperError,helperCall } from '@/lib/admin-helper/client';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
async function identity(request:Request) {
  const session=await requireUser(),owner=requireOpenCodeIdentity(db(),{email:session.user?.email,mobileDeviceId:session.mobileDeviceId});
  const secret=process.env.AUTH_SECRET;if(!secret)throw new HelperError();
  const raw=await getToken({req:request,secret,cookieName:'__Secure-authjs.session-token',salt:'__Secure-authjs.session-token',secureCookie:true,raw:true});
  if(!raw)throw new AccessError('Bejelentkezés szükséges.',401);
  return {actor:owner.email,sessionHash:createHash('sha256').update(raw).digest('hex')};
}
function failure(error:unknown){
  if(!(error instanceof AccessError) && !(error instanceof HelperError)){
    const code=error && typeof error==='object' && 'code' in error?String(error.code):'';
    console.error('Admin helper unavailable',/^[A-Z_0-9]{1,40}$/.test(code)?code:error instanceof Error?error.name:'unknown');
  }
  return Response.json({error:error instanceof AccessError || error instanceof HelperError?error.message:'Az admin-segéd még nincs telepítve vagy nem érhető el.'},{status:error instanceof AccessError || error instanceof HelperError?error.status:503,headers});
}
export async function GET(request:Request) {
  try{await identity(request);if(process.env.ADMIN_HELPER_ENABLED!=='true')return Response.json({available:false,targets:[],jobs:[]},{headers});return Response.json(await helperCall('/v1/status'),{headers});}catch(error){return failure(error);}
}
export async function POST(request:Request) {
  try{
    const data=await adminBody(request),context=await identity(request);
    if(process.env.ADMIN_HELPER_ENABLED!=='true')throw new HelperError();
    const path=data.action==='request'?'/v1/request':data.action==='review'?'/v1/review':data.action==='confirm'?'/v1/confirm':'/v1/cancel';
    const payload=data.action==='request'?{target:data.target,requestedBy:'Tulajdonosi dashboard'}:{id:data.id,...context,...(data.action==='confirm'?{confirmation:data.confirmation}:{})};
    return Response.json(await helperCall(path,payload),{status:data.action==='confirm'?202:200,headers});
  }catch(error){return failure(error);}
}
