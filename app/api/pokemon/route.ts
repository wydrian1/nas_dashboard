import { requireUser, authError } from "@/auth";
import { pokemonSnapshot } from "@/lib/pokemon/data";

export async function GET() {
  try {const session=await requireUser();return Response.json(pokemonSnapshot(session.user!.email!,session.role!),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return authError(error);}
}
