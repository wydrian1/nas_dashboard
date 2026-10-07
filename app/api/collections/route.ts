import { requireAdmin, authError } from '@/auth';
import { db } from '@/lib/db';
import { readLego } from '@/lib/finance/lego';
import { readPokemonCollection } from '@/lib/finance/pokemon-collection';

export const runtime='nodejs';
export async function GET() {
  try{await requireAdmin();}catch(error){return authError(error);}
  const database=db();
  return Response.json({lego:readLego(database),pokemon:readPokemonCollection(database),currency:'HUF',amountScale:100},{headers:{'Cache-Control':'private, no-store'}});
}
