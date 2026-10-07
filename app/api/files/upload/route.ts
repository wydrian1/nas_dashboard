import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {uploadHostedFile} from '@/lib/file-hosting/storage';
import {hostingFailure,hostingWriteOrigin,parentFromUrl} from '@/lib/file-hosting/http';
import {HostingError} from '@/lib/file-hosting/types';

export const runtime='nodejs';
export async function POST(request:Request) {
  let actor:string;try{actor=(await requireAdmin()).user!.email!;}catch(error){return authError(error);}
  try{
    hostingWriteOrigin(request);const params=new URL(request.url).searchParams;if(params.getAll('name').length!==1)throw new HostingError('Egy fájlnév szükséges.');
    return Response.json(await uploadHostedFile(db(),parentFromUrl(request),params.get('name'),actor,request),{status:201,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return hostingFailure(error);}
}
