import {requireUser} from '@/auth';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import {listOpenCodePreviews} from '@/lib/opencode-preview';
export const runtime='nodejs';
export async function GET(){
  const session=await requireUser().catch(()=>null);
  if(!session||session.role!=='admin'||!isOpenCodeOwner(session.user?.email))return Response.json({error:'Nincs hozzáférés.'},{status:403,headers:{'Cache-Control':'no-store'}});
  try{return Response.json({previews:(await listOpenCodePreviews()).map(({sha256,...item})=>item)},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Az előnézetek nem érhetők el.'},{status:503});}
}
