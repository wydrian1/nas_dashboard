import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {operationalHealth} from '@/lib/operational-health';
export const dynamic='force-dynamic';
export async function GET(){try{const session=await requireAdmin();return Response.json(operationalHealth(db(),session.user!.email!),{headers:{'Cache-Control':'no-store'}});}catch(error){return authError(error);}}
