import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {listing} from '@/lib/file-hosting/store';
import {hostingFailure,parentFromUrl,shareUrl} from '@/lib/file-hosting/http';

export const runtime='nodejs';
export async function GET(request:Request) {
  try{await requireAdmin();}catch(error){return authError(error);}
  try{const result=listing(db(),parentFromUrl(request));return Response.json({...result,links:result.links.map(link=>({...link,url:link.revoked_at===null?shareUrl(request,link.id):null}))},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return hostingFailure(error);}
}
