import { db } from '@/lib/db';
import { startPair, exchangePair, deviceBySecret } from '@/lib/mobile/store';
import { mobileBody, mobileError, mobileHeaders, sessionResponse } from '@/lib/mobile/http';
import { roleFor } from '@/lib/users';

export async function POST(request:Request) {
  try{
    const body=await mobileBody(request),database=db();
    if(body.action==='start')return Response.json(startPair(database,body.challenge,body.label),{status:201,headers:mobileHeaders});
    if(body.action!=='exchange')return Response.json({error:'Ismeretlen művelet.'},{status:400,headers:mobileHeaders});
    const result=exchangePair(database,body.id,body.verifier);
    if(!result)return Response.json({pending:true},{status:202,headers:mobileHeaders});
    const device=deviceBySecret(database,result.secret);
    return await sessionResponse(device,roleFor(database,device.email)!,result);
  }catch(error){return mobileError(error);}
}
