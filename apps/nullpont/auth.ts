import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from './lib/db';
import { playerAuthorized, verifiedEmail } from './lib/access';
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [Google], trustHost: true,
  cookies: { sessionToken: { name: process.env.AUTH_URL?.startsWith('https:') ? '__Secure-nullpont.session-token' : 'nullpont.session-token', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.AUTH_URL?.startsWith('https:') || false } } },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 }, pages: { signIn: '/', error: '/' },
  callbacks: { signIn({ account, profile }) { return account?.provider === 'google' && playerAuthorized(db(), verifiedEmail(profile)); } },
});
export async function requirePlayer() {
  const session = await auth();
  if (!session?.user?.email || !playerAuthorized(db(), session.user.email)) throw new Error('Bejelentkezés szükséges.');
  return { email: session.user.email.trim().toLowerCase(), name: session.user.name };
}
