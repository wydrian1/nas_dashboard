import {db} from '@/lib/db';
import {bearer,mobileError,mobileHeaders} from '@/lib/mobile/http';
import {deviceBySecret,MobileError} from '@/lib/mobile/store';
import {mobileShopPolicy} from '@/lib/mobile/shop-policy';
export const runtime='nodejs';
export async function GET(request:Request){
  try{
    const origin=request.headers.get('origin');if(origin&&origin!=='https://nas.wydrian.hu')throw new MobileError('Nem engedélyezett eredet.',403);
    deviceBySecret(db(),bearer(request));
    return Response.json(mobileShopPolicy(),{headers:mobileHeaders});
  }catch(error){return mobileError(error);}
}
