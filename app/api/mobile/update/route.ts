import {db} from '@/lib/db';
import {bearer,mobileError,mobileHeaders} from '@/lib/mobile/http';
import {deviceBySecret,MobileError} from '@/lib/mobile/store';
import {publishedApk} from '@/lib/mobile/apk-release';
export const runtime='nodejs';
export async function GET(request:Request){
  try{
    const origin=request.headers.get('origin');if(origin&&origin!=='https://nas.wydrian.hu')throw new MobileError('Nem engedélyezett eredet.',403);
    deviceBySecret(db(),bearer(request));const apk=await publishedApk();
    if(new URL(request.url).searchParams.get('apk')==='1')return new Response(new Uint8Array(apk.bytes),{headers:{...mobileHeaders,'Content-Type':'application/vnd.android.package-archive','Content-Length':String(apk.bytes.length),'X-Content-Type-Options':'nosniff'}});
    return Response.json({...apk.release,path:'/api/mobile/update?apk=1'},{headers:mobileHeaders});
  }catch(error){return error instanceof MobileError?mobileError(error):Response.json({error:'A kiadás jelenleg nem érhető el.'},{status:503,headers:mobileHeaders});}
}
