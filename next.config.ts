import type { NextConfig } from "next";
import {OPENCODE_PREVIEW_CSP} from './lib/opencode-preview-policy';
import {TRAVEL_CSP} from './lib/travel';

const config: NextConfig = {
  distDir: process.env.DASHBOARD_BUILD_DIR || ".next",
  serverExternalPackages: ["node:sqlite"],
  // Runtime data/credentials stay on the server; never trace or ship live WAL,
  // private service state, credentials, archives or previous releases in a build.
  outputFileTracingExcludes: {"/*": ["./data/**/*", "./.runtime/**/*", "./cert/**/*", "./logs/**/*", "./.env*", "./.next-backup-*/**/*"]},
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" }
    ] }, ...['/s/:token','/api/files/:id/download'].map(source=>({source,headers:[
      // Next's global response rules override route headers; retain the stricter
      // download policy here too so uploaded active content is never executable.
      {key:'Content-Security-Policy',value:"sandbox; default-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'"}
    ]})),{source:'/api/travel/itinerary',headers:[
      // Only the authenticated itinerary can embed; it has no script/same-origin privilege.
      {key:'X-Frame-Options',value:'SAMEORIGIN'},
      {key:'Content-Security-Policy',value:TRAVEL_CSP}
    ]},{source:'/api/opencode/previews/:id',headers:[
      // Only authenticated owner snapshots may embed on their own origin.
      // All other dashboard pages retain DENY and frame-ancestors 'none'.
      {key:'X-Frame-Options',value:'SAMEORIGIN'},
      {key:'Content-Security-Policy',value:OPENCODE_PREVIEW_CSP}
    ]}];
  }
};
export default config;
