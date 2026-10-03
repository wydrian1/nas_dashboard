import { getToken } from 'next-auth/jwt';
import { requireUser,authError } from '@/auth';
import { db } from '@/lib/db';
import { checkOpenCodeLaunchOrigin,mintOpenCodeLease,OPENCODE_ORIGIN,requireOpenCodeIdentity } from '@/lib/opencode-access';
import { AccessError } from '@/lib/users';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  try{
    checkOpenCodeLaunchOrigin(request);const session=await requireUser();requireOpenCodeIdentity(db(),{email:session.user?.email,mobileDeviceId:session.mobileDeviceId});
    if(process.env.OPENCODE_WEB_ENABLED!=='true')return Response.json({error:'Az OpenCode webes átjáró még nincs beállítva.'},{status:503,headers:{'Cache-Control':'no-store'}});
    const secret=process.env.AUTH_SECRET;if(!secret)throw new Error('Missing authentication secret');
    const parent=await getToken({req:request,secret,salt:'__Secure-authjs.session-token',cookieName:'__Secure-authjs.session-token',secureCookie:true});
    if(!parent)throw new AccessError('Bejelentkezés szükséges.',401);
    return Response.json({origin:OPENCODE_ORIGIN},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':await mintOpenCodeLease(db(),parent,secret,request.headers.get('cookie'))}});
  }catch(error){return authError(error);}
}
