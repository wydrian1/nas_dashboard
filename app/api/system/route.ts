import { requireAdmin, authError } from "@/auth";
import { systemSnapshot } from "@/lib/system-info";

export const runtime = "nodejs";
export async function GET() {
  try { await requireAdmin(); } catch (error) { return authError(error); }
  return Response.json(await systemSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
