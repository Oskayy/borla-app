import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// What the browser may load. Mapbox draws the maps (tiles, styles, a web worker); Supabase serves logins
// and photos. Paystack checkout is a full-page redirect, so it needs no entry here.
// Enforced since 15 Oct 2026, after a crawl of the public, customer and driver pages (light and dark) showed no
// violations. Inline scripts stay allowed ('unsafe-inline') because Next.js needs them unless every page is rendered
// per request with a nonce. A new outside service the browser talks to must be added here, or it will be blocked.
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
  // Pictures Next.js may resize and send as WebP: vehicle pictures (public bucket) and the landing page's area map.
  // Private photos (pickups, driver documents) are shown with `unoptimized` and never go through this service.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/vehicle-images/**" },
      { protocol: "https", hostname: "api.mapbox.com", pathname: "/styles/v1/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Browsers only ever use HTTPS for this site after the first visit (ignored on http://localhost).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
