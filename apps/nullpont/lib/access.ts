import type { DatabaseSync } from 'node:sqlite';
export function verifiedEmail(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const value = profile as { email?: unknown; email_verified?: unknown };
  return value.email_verified === true && typeof value.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) ? value.email.trim().toLowerCase() : null;
}
export function playerAuthorized(database: DatabaseSync, email: unknown, allowed = process.env.NULLPONT_ALLOWED_EMAILS || '') {
  if (typeof email !== 'string' || !email.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const player = database.prepare('SELECT enabled FROM players WHERE email=?').get(normalized);
  if (player) return player.enabled === 1;
  return allowed.split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(normalized);
}
