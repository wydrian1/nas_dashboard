import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.DASHBOARD_BUILD_DIR || '.next',
  serverExternalPackages: ['node:sqlite'],
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: { '/*': ['./data/**/*', './.runtime/**/*', './.env*'] },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }];
  },
};
export default config;
