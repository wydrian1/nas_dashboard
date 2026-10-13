import { basePath } from './paths.ts';
export function ssoConfig() {
  function origin(value: string | undefined, path = '') {
    if (!value) throw new Error('SSO origin missing');
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || ![path || '/', path + '/'].includes(url.pathname) || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1'))) throw new Error('Invalid SSO origin');
    return url.origin + path;
  }
  const dashboard = origin(process.env.NULLPONT_DASHBOARD_URL), application = origin(process.env.AUTH_URL, basePath());
  if (dashboard === application || !process.env.NULLPONT_SSO_SECRET || process.env.NULLPONT_SSO_SECRET.length < 32 || !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('SSO configuration incomplete');
  return { dashboard, application, secret: process.env.NULLPONT_SSO_SECRET };
}
