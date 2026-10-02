import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.DASHBOARD_BUILD_DIR || ".next",
  serverExternalPackages: ["node:sqlite"],
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
