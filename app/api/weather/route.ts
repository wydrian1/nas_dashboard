import { requireAdmin, authError } from "@/auth";
import { weatherLocation } from "@/lib/personal-data";
import { forecast } from "@/lib/weather";

export async function GET() {
  try { await requireAdmin(); } catch (error) { return authError(error); }
  const location = weatherLocation();
  if (!location) return Response.json({error:"Előbb válassz települést."},{status:400});
  try { return Response.json(await forecast(location),{headers:{"Cache-Control":"no-store"}}); }
  catch { return Response.json({error:"Az időjárás most nem tölthető be. Próbáld újra később."},{status:502}); }
}
