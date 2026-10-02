import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { verifiedProfileEmail } from "@/lib/access";
import { roleFor, AccessError } from "@/lib/users";
import { db } from "@/lib/db";
import { deviceAuthorized } from "@/lib/mobile/store";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/", error: "/" },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && !!roleFor(db(),verifiedProfileEmail(profile));
    },
    session({ session, token }) {
      // Never expose OAuth access/refresh tokens to the client.
      if(typeof token.mobileDeviceId==='string')session.mobileDeviceId=token.mobileDeviceId;
      session.role=roleFor(db(),session.user?.email);
      return session;
    }
  }
});

export async function requireUser() {
  const session = await auth();
  const role=roleFor(db(),session?.user?.email);
  if (!session || !role) throw new AccessError('Bejelentkezés szükséges.',401);
  session.role=role;
  if(session.mobileDeviceId && !deviceAuthorized(db(),session.mobileDeviceId,session.user!.email!))throw new AccessError('Az eszköz hozzáférése lejárt vagy visszavont.',401);
  return session;
}
export async function requireAdmin() {
  const session=await requireUser();
  if(session.role!=='admin')throw new AccessError();
  return session;
}
export function authError(error:unknown) {
  return Response.json({error:error instanceof AccessError ? error.message : 'Bejelentkezés szükséges.'},{status:error instanceof AccessError ? error.status : 401,headers:{'Cache-Control':'no-store'}});
}
