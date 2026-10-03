import { db } from '@/lib/db';
import { authError } from '@/auth';
import { verifyOpenCodeLease } from '@/lib/opencode-access';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try{
    if(process.env.OPENCODE_WEB_ENABLED!=='true')return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});
    const secret=process.env.AUTH_SECRET;if(!secret)throw new Error('Missing authentication secret');
    await verifyOpenCodeLease(db(),request.headers.get('cookie'),secret);
    return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  }catch(error){return authError(error);}
}
