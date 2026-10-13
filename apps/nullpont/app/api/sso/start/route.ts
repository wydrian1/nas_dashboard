import { randomBytes, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ssoConfig } from '@/lib/sso-config';
import { basePath } from '@/lib/paths';
export async function GET() {
  try {
    const { dashboard, application } = ssoConfig();
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
    const destination = new URL('/api/nullpont/authorize', dashboard);
    destination.searchParams.set('state', state); destination.searchParams.set('challenge', createHash('sha256').update(verifier).digest('base64url'));
    const response = NextResponse.redirect(destination, 303);
    response.headers.set('Cache-Control', 'no-store'); response.headers.set('Referrer-Policy', 'no-referrer');
    response.cookies.set(application.startsWith('https:') ? (basePath() ? '__Secure-nullpont.login' : '__Host-nullpont.login') : 'nullpont.login', state + '.' + verifier, { httpOnly: true, sameSite: 'lax', secure: application.startsWith('https:'), path: basePath() || '/', maxAge: 120 });
    return response;
  } catch { return new Response('A dashboard-belépés még nincs beállítva.', { status: 503 }); }
}
