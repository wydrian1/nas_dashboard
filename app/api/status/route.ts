import { requireAdmin, authError } from "@/auth";
import { serviceStatuses } from "@/lib/services";

export async function GET() {
  try { await requireAdmin(); } catch (error) { return authError(error); }
  return Response.json(await serviceStatuses(), { headers: { "Cache-Control": "no-store" } });
}
