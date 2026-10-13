import { createHmac, timingSafeEqual } from 'node:crypto';
export function sessionToken(email: string, secret: string, now = Date.now()) {
  if (secret.length < 32) throw new Error('Independent AUTH_SECRET required');
  const body = Buffer.from(JSON.stringify({ email, expires: now + 12 * 60 * 60 * 1000 })).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
export function sessionEmail(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || secret.length < 32 || token.length > 1024) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(body).digest(), actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { const value = JSON.parse(Buffer.from(body, 'base64url').toString()); return typeof value.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) && Number.isSafeInteger(value.expires) && value.expires > now && value.expires <= now + 12 * 60 * 60 * 1000 ? value.email : null; } catch { return null; }
}
