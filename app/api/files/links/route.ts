import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {createHostingLink,revokeHostingLink} from '@/lib/file-hosting/store';
import {hostingFailure,hostingWriteOrigin,hostingJson,shareUrl} from '@/lib/file-hosting/http';
import {hostingId} from '@/lib/file-hosting/types';

export const runtime='nodejs';
export async function POST(request:Request) {
  let actor:string;try{actor=(await requireAdmin()).user!.email!;}catch(error){return authError(error);}
  try{hostingWriteOrigin(request);const data=await hostingJson(request),link=createHostingLink(db(),hostingId(data.fileId),data.expiresAt,actor,process.env.AUTH_SECRET||'');return Response.json({...link,url:shareUrl(request,link.id)},{status:201,headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return hostingFailure(error);}
}
export async function DELETE(request:Request) {
  let actor:string;try{actor=(await requireAdmin()).user!.email!;}catch(error){return authError(error);}
  try{hostingWriteOrigin(request);const data=await hostingJson(request);revokeHostingLink(db(),data.id,actor);return Response.json({success:true},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return hostingFailure(error);}
}
