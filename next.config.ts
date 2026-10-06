import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.DASHBOARD_BUILD_DIR || ".next",
  serverExternalPackages: ["node:sqlite"],
  // Runtime data/credentials stay on the server; never trace or ship live WAL,
  // private service state, credentials, archives or previous releases in a build.
  outputFileTracingExcludes: {"/*": ["./data/**/*", "./.runtime/**/*", "./logs/**/*", "./.env*", "./.next-backup-*/**/*"]},
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" }
    ] }];
  }
};
export default config;
