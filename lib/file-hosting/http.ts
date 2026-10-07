import {HostingError,hostingId} from './types';
import {dashboardSameOrigin,dashboardRequestOrigin} from '@/lib/dashboard-origin';
import {signHostingLink} from './store';

export function hostingFailure(error:unknown,publicLink=false) {
  const status=error instanceof HostingError?error.status:(error as NodeJS.ErrnoException)?.code==='ENOENT'?404:503;
  const message=publicLink&&status!==429?'A megosztás nem érhető el.':error instanceof HostingError?error.message:'A hosting művelet nem sikerült.';
  return Response.json({error:message},{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});
}
export function hostingWriteOrigin(request:Request) {
  if(!dashboardSameOrigin(request))throw new HostingError('Csak azonos eredetű kérés engedélyezett.',403);
  try{dashboardRequestOrigin(request.headers);}catch{throw new HostingError('Érvénytelen dashboard eredet.',403);}
}
export function parentFromUrl(request:Request):string|null {
  const params=new URL(request.url).searchParams;if(params.getAll('folder').length>1)throw new HostingError('Ismétlődő mappaazonosító.');return params.has('folder')?hostingId(params.get('folder')):null;
}
export async function hostingJson(request:Request):Promise<Record<string,unknown>> {
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HostingError('JSON-kérés szükséges.');
  const reader=request.body?.getReader();if(!reader)throw new HostingError('Hiányzó kérés.');const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>4096){await reader.cancel();throw new HostingError('Túl nagy kérés.',413);}chunks.push(result.value);}}
  finally{reader.releaseLock();}
  try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}
  catch{throw new HostingError('Érvénytelen JSON-kérés.');}
}
export function shareUrl(request:Request,id:string) {
  return dashboardRequestOrigin(request.headers)+'/s/'+signHostingLink(id,process.env.AUTH_SECRET||'');
}
