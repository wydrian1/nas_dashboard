import { db } from '@/lib/db';
import { deviceBySecret, updateDevice, revokeDevice, queueTestPush, MobileError } from '@/lib/mobile/store';
import { bearer, mobileBody, mobileError, sessionResponse, mobileHeaders } from '@/lib/mobile/http';
import { pushConfigured } from '@/lib/mobile/push';
import { roleFor } from '@/lib/users';

export async function POST(request:Request) {
  try{
    const body=await mobileBody(request),database=db(),device=deviceBySecret(database,bearer(request));
    if(body.action==='session'){
      database.prepare('UPDATE mobile_devices SET last_seen=? WHERE id=?').run(Date.now(),device.id);
       return await sessionResponse(device,roleFor(database,device.email)!,{pushConfigured:pushConfigured()});
    }
    if(body.action==='register'){updateDevice(database,device,body.token ?? null,body.enabled);return Response.json({ok:true,pushConfigured:pushConfigured()},{headers:mobileHeaders});}
    if(body.action==='revoke'){revokeDevice(database,device.id);return Response.json({ok:true},{headers:mobileHeaders});}
    if(body.action==='test'){
      if(!pushConfigured())throw new MobileError('A szerver push küldése még nincs beállítva.',503);
      queueTestPush(database,device);return Response.json({queued:true},{status:202,headers:mobileHeaders});
    }
    throw new MobileError('Ismeretlen művelet.');
  }catch(error){return mobileError(error);}
}
