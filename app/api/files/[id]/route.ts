import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {deleteHostedFile} from '@/lib/file-hosting/storage';
import {hostingFailure,hostingWriteOrigin} from '@/lib/file-hosting/http';
import {hostingId} from '@/lib/file-hosting/types';
export const runtime='nodejs';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  let actor:string;try{actor=(await requireAdmin()).user!.email!;}catch(error){return authError(error);}
  try{hostingWriteOrigin(request);await deleteHostedFile(db(),hostingId((await params).id),actor);return Response.json({success:true},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return hostingFailure(error);}
}
