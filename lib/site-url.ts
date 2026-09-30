import type { NextRequest } from 'next/server'

// The public address of the app, used in links inside emails (confirm your email, reset your password).
// Set NEXT_PUBLIC_SITE_URL in production (e.g. https://borla-app-iota.vercel.app). Without it, the address
// the request came in on is used, so links still point back to wherever the app is running.
export function siteUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  return new URL(req.url).origin
}
