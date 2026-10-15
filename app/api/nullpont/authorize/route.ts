import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { nullpontUrl } from '@/lib/nullpont-link';
import { issueNullpontCode } from '@/lib/nullpont-sso';
export async function GET(request: Request) {
  const destination = nullpontUrl(process.env.NULLPONT_URL);
  if (!destination || !process.env.NULLPONT_SSO_SECRET || process.env.NULLPONT_SSO_SECRET.length < 32) return new Response('NULLPONT belépés nincs beállítva.', { status: 503 });
  const parameters = new URL(request.url).searchParams;
  const state = parameters.get('state'), challenge = parameters.get('challenge');
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) || !challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return new Response('Érvénytelen belépési kérés.', { status: 400 });
  const session = await requireUser().catch(() => null);
  if (!session) return new Response(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store' } });
  const callback = new URL(destination.replace(/\/$/, '') + '/api/sso/callback');
  callback.searchParams.set('state', state);
  callback.searchParams.set('code', issueNullpontCode(db(), session.user!.email!, challenge));
  return new Response(null, { status: 303, headers: { Location: callback.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
