import { requireAdmin, authError } from "@/auth";
import { searchCities } from "@/lib/weather";

export async function GET(request: Request) {
  try { await requireAdmin(); } catch (error) { return authError(error); }
  const query = (new URL(request.url).searchParams.get("q") || "").trim();
  if (query.length<2 || query.length>80) return Response.json({error:"2–80 karakter hosszú településnevet adj meg."},{status:400});
  try { return Response.json(await searchCities(query),{headers:{"Cache-Control":"no-store"}}); }
  catch { return Response.json({error:"A településkeresés most nem érhető el."},{status:502}); }
}
