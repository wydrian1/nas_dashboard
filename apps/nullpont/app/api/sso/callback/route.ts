import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ssoConfig } from '@/lib/sso-config';
import { sessionToken } from '@/lib/session';
import { sessionCookie } from '@/auth';
import { db } from '@/lib/db';
import { basePath, applicationUrl } from '@/lib/paths';
export async function GET(request: Request) {
  let config;
  try { config = ssoConfig(); } catch { return new Response('SSO nincs beállítva.', { status: 503 }); }
  const response = NextResponse.redirect(applicationUrl('/?sso=failed', config.application), 303);
  const loginCookie = config.application.startsWith('https:') ? (basePath() ? '__Secure-nullpont.login' : '__Host-nullpont.login') : 'nullpont.login';
  response.cookies.set(loginCookie, '', { path: basePath() || '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: config.application.startsWith('https:') });
  response.headers.set('Cache-Control', 'no-store'); response.headers.set('Referrer-Policy', 'no-referrer');
  const pending = (await cookies()).get(loginCookie)?.value;
  const [state, verifier] = pending?.split('.') || [];
  const parameters = new URL(request.url).searchParams, code = parameters.get('code');
  if (!state || !verifier || parameters.get('state') !== state || !code || !/^[A-Za-z0-9_-]{43}$/.test(code)) return response;
  try {
    const result = await fetch(new URL('/api/nullpont/redeem', config.dashboard), { method: 'POST', headers: { Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' }, body: JSON.stringify({ code, verifier }), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!result.ok) return response;
    const { email } = await result.json();
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response;
    // Dashboard is the identity authority; explicit local bans remain effective.
    db().prepare('INSERT INTO players(email,enabled) VALUES(?,1) ON CONFLICT(email) DO NOTHING').run(email);
    const player = db().prepare('SELECT enabled FROM players WHERE email=?').get(email);
    if (player?.enabled !== 1) return response;
    response.cookies.set(sessionCookie(), sessionToken(email, process.env.AUTH_SECRET!), { httpOnly: true, sameSite: 'lax', secure: config.application.startsWith('https:'), path: basePath() || '/', maxAge: 12 * 60 * 60 });
    response.headers.set('Location', applicationUrl('/', config.application));
  } catch { /* Never expose codes, secrets, upstream errors or identities. */ }
  return response;
}
