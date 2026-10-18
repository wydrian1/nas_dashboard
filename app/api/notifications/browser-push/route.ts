import {authError,requireUser} from '@/auth';
import {db} from '@/lib/db';
import {browserPushConfigured} from '@/lib/mobile/browser-push-config';
import {MobileError,registerBrowserPush,removeBrowserPush} from '@/lib/mobile/store';
import {dashboardSameOrigin} from '@/lib/dashboard-origin';
import {roleFor} from '@/lib/users';

export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
function failure(error:unknown){return Response.json({error:error instanceof MobileError?error.message:'A böngésző-push művelet nem sikerült.'},{status:error instanceof MobileError?error.status:400,headers});}
async function actor(request:Request,mutation=false){
  const session=await requireUser();
  if(session.role==='info-reader')throw new MobileError('Ehhez a szerepkörhöz nincs push-értesítés.',403);
  if(mutation&&!dashboardSameOrigin(request))throw new MobileError('Nem engedélyezett kérés-eredet.',403);
  return session.user!.email!;
}
async function body(request:Request){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new MobileError('JSON kérés szükséges.',415);
  const declared=request.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>8192))throw new MobileError('Túl nagy kérés.',413);
  if(!request.body)throw new MobileError('Üres kérés.');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();throw new MobileError('Túl nagy kérés.',413);}chunks.push(part.value);}}finally{reader.releaseLock();}
  try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();return value as Record<string,unknown>;}catch(error){if(error instanceof MobileError)throw error;throw new MobileError('Hibás kérés.');}
}
export async function GET(request:Request){
  try{const email=await actor(request),database=db(),count=database.prepare("SELECT count(*) AS n FROM mobile_devices WHERE email=? AND device_type='browser' AND revoked=0 AND push_enabled=1 AND fcm_token IS NOT NULL AND expires_at>?").get(email.toLowerCase(),Date.now()) as {n:number};return Response.json({configured:browserPushConfigured(),subscriptions:count.n,role:roleFor(database,email)},{headers});}
  catch(error){return error instanceof MobileError?failure(error):authError(error);}
}
export async function POST(request:Request){
  try{const email=await actor(request,true),data=await body(request);if(Object.keys(data).some(key=>!['token','label'].includes(key)))throw new MobileError('Érvénytelen kérésmező.');if(!browserPushConfigured())throw new MobileError('A böngészős push Firebase-beállítása még hiányzik.',503);const result=registerBrowserPush(db(),email,data.token,data.label);return Response.json({ok:true,expiresAt:result.expiresAt},{status:201,headers});}
  catch(error){return error instanceof MobileError?failure(error):authError(error);}
}
export async function DELETE(request:Request){
  try{const email=await actor(request,true),data=await body(request);if(Object.keys(data).some(key=>key!=='token'))throw new MobileError('Érvénytelen kérésmező.');removeBrowserPush(db(),email,data.token);return Response.json({ok:true},{headers});}
  catch(error){return error instanceof MobileError?failure(error):authError(error);}
}
