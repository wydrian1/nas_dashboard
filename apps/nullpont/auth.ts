import 'server-only';
import { cookies } from 'next/headers';
import { db } from './lib/db';
import { playerAuthorized } from './lib/access';
import { sessionEmail } from './lib/session';
export function sessionCookie() { return process.env.AUTH_URL?.startsWith('https:') ? '__Host-nullpont.session-token' : 'nullpont.session-token'; }
export async function requirePlayer() {
  const email = sessionEmail((await cookies()).get(sessionCookie())?.value, process.env.AUTH_SECRET || '');
  if (!email || !playerAuthorized(db(), email)) throw new Error('Bejelentkezés szükséges.');
  return { email, name: null };
}
