import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
export const ssoHash = (value: string) => createHash('sha256').update(value).digest('base64url');
export function initializeNullpontSso(database: DatabaseSync) {
  database.exec('CREATE TABLE IF NOT EXISTS nullpont_login_codes(code_hash TEXT PRIMARY KEY,email TEXT NOT NULL,challenge TEXT NOT NULL,expires INTEGER NOT NULL)');
}
export function bridgeSecretMatches(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from('Bearer ' + secret), actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function issueNullpontCode(database: DatabaseSync, email: string, challenge: string, now = Date.now()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new Error('Invalid challenge');
  initializeNullpontSso(database);
  database.prepare('DELETE FROM nullpont_login_codes WHERE expires<=?').run(now);
  const code = randomBytes(32).toString('base64url');
  database.prepare('INSERT INTO nullpont_login_codes VALUES(?,?,?,?)').run(ssoHash(code), email.trim().toLowerCase(), challenge, now + 60000);
  return code;
}
export function redeemNullpontCode(database: DatabaseSync, code: unknown, verifier: unknown, now = Date.now()) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code) || typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(verifier)) return null;
  initializeNullpontSso(database);
  const row = database.prepare('DELETE FROM nullpont_login_codes WHERE code_hash=? AND challenge=? AND expires>? RETURNING email').get(ssoHash(code), ssoHash(verifier), now);
  return typeof row?.email === 'string' ? row.email : null;
}
