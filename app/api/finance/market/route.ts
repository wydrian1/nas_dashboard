import { requireAdmin, authError } from '@/auth';
import { financeMarket } from '@/lib/finance/market';
export const runtime='nodejs';
export async function GET() {
  try{await requireAdmin();}catch(error){return authError(error);}
  return Response.json(await financeMarket(),{headers:{'Cache-Control':'private, no-store'}});
}
