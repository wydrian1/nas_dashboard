import {requireAdmin,authError} from '@/auth';
import {readTravelItinerary,TRAVEL_HEADERS} from '@/lib/travel';

export const dynamic='force-dynamic';
export async function GET(){
  try{await requireAdmin();}catch(error){return authError(error);}
  try{
    const document=readTravelItinerary();
    if(document===null)return new Response('Még nincs útiterv.',{status:404,headers:TRAVEL_HEADERS});
    return new Response(document,{headers:TRAVEL_HEADERS});
  }catch{return new Response('Az útiterv most nem olvasható.',{status:500,headers:TRAVEL_HEADERS});}
}
