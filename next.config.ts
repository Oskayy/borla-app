import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// What the browser may load. Mapbox draws the maps (tiles, styles, a web worker); Supabase serves logins
// and photos. Paystack checkout is a full-page redirect, so it needs no entry here.
// Report-only for now: the browser logs anything that would be blocked but doesn't block it.
// Once the console stays clean in normal use, rename the header to "Content-Security-Policy".
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://api.mapbox.com https://*.tiles.mapbox.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
  "worker-src 'self' blob:",
  "child-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Browsers only ever use HTTPS for this site after the first visit (ignored on http://localhost).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
