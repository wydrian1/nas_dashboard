import {requireUser} from '@/auth';
import {isOpenCodeOwner} from '@/lib/opencode-access';
import {openCodePreviewResponse} from '@/lib/opencode-preview';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await requireUser().catch(()=>null);
  if(!session||session.role!=='admin'||!isOpenCodeOwner(session.user?.email))return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
  try{return await openCodePreviewResponse((await params).id);}catch{return new Response('Előnézet nem érhető el.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
