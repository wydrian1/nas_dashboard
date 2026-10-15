import { db } from '@/lib/db';
import { roleFor } from '@/lib/users';
import { bridgeSecretMatches, redeemNullpontCode } from '@/lib/nullpont-sso';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!bridgeSecretMatches(request.headers.get('authorization'), process.env.NULLPONT_SSO_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const body = await request.text();
  if (body.length > 1024) return Response.json({ error: 'Invalid request' }, { status: 400, headers });
  try {
    const { code, verifier } = JSON.parse(body);
    const email = redeemNullpontCode(db(), code, verifier);
    if (!email || !roleFor(db(), email)) return Response.json({ error: 'Invalid or expired code' }, { status: 401, headers });
    return Response.json({ email }, { headers });
  } catch { return Response.json({ error: 'Invalid request' }, { status: 400, headers }); }
}
