import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {createHostingFolder} from '@/lib/file-hosting/storage';
import {hostingFailure,hostingWriteOrigin,hostingJson} from '@/lib/file-hosting/http';
import {hostingId} from '@/lib/file-hosting/types';

export const runtime='nodejs';
export async function POST(request:Request) {
  let actor:string;try{actor=(await requireAdmin()).user!.email!;}catch(error){return authError(error);}
  try{hostingWriteOrigin(request);const data=await hostingJson(request),folder=data.parent===null?null:hostingId(data.parent);return Response.json(await createHostingFolder(db(),folder,data.name,actor),{status:201,headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return hostingFailure(error);}
}
