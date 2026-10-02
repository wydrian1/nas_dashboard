export function isAllowedProfile(profile: unknown, email: string): boolean {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as Record<string, unknown>;
  return p.email_verified === true && typeof p.email === "string"
    && p.email.toLowerCase() === email.toLowerCase();
}
export function verifiedProfileEmail(profile:unknown):string|null {
  if(!profile || typeof profile!=='object')return null;
  const p=profile as Record<string,unknown>;
  return p.email_verified===true && typeof p.email==='string' ? p.email.trim().toLowerCase() : null;
}
