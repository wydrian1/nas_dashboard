import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HELPER_ORIGIN,helperHeaders,verifyHelperResponse,type HelperStatus,type HelperJob } from './protocol.ts';
export class HelperError extends Error {status:number;constructor(status=503,message='Az admin-segéd jelenleg nem érhető el.'){super(message);this.status=status;}}
type Credentials={key:string};
export function helperCredentialPath(){return join(process.env.ProgramFiles || process.env.PROGRAMFILES || 'C:\\Program Files','Wydrian NAS Admin Helper','credentials.json');}
export async function helperCall(path:'/v1/status'|'/v1/request'|'/v1/review'|'/v1/confirm'|'/v1/cancel',payload?:Record<string,unknown>,options?:{credentials:Credentials;origin:string;fetch:typeof fetch}) {
  const credentials=options?.credentials || JSON.parse(await readFile(helperCredentialPath(),'utf8')) as Credentials;
  const method=payload?'POST':'GET',body=payload?JSON.stringify(payload):'';
  const signed=helperHeaders(method,path,body,credentials.key,'control');
  const response=await (options?.fetch || fetch)((options?.origin || HELPER_ORIGIN)+path,{method,headers:signed,...(payload?{body}:{}),redirect:'manual',signal:AbortSignal.timeout(7000),cache:'no-store'});
  const reader=response.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>128*1024){await reader.cancel();throw new HelperError();}chunks.push(item.value);}}finally{reader.releaseLock();}
  const responseBody=Buffer.concat(chunks).toString('utf8');
  if(!verifyHelperResponse(response.status,responseBody,credentials.key,'control',signed['X-Nas-Nonce'],response.headers.get('X-Nas-Response')))throw new HelperError();
  let data:unknown;try{data=JSON.parse(responseBody);}catch{throw new HelperError();}
  if(!response.ok){const status=[400,403,404,409,410,429].includes(response.status)?response.status:503;throw new HelperError(status,status===409?'A kérés másik munkamenethez tartozik, már lezárult, vagy más művelet fut.':status===410?'A jóváhagyási kérés lejárt.':status===429?'Túl sok kérés. Várj néhány percet.':status===400?'A művelet adatai vagy a megerősítés nem megfelelőek.':'Az admin-segéd nem fogadta el a kérést.');}
  if(!data || typeof data!=='object' || Array.isArray(data))throw new HelperError();
  return data as HelperStatus|{job:HelperJob};
}
