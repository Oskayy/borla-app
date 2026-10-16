// Page-speed measurements (Core Web Vitals) sent anonymously by browsers (components/WebVitals.tsx, /api/vitals).
// Only the metric, its value and rating, the kind of screen and the page's path are kept, with ids taken out of the
// path, so nothing in it points to a person or an order. No cookies, no account, no IP address.

export const VITAL_NAMES = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const
const RATINGS = ['good', 'needs-improvement', 'poor'] as const
const DEVICES = ['phone', 'tablet', 'computer'] as const

export type Vital = {
  name: (typeof VITAL_NAMES)[number]
  value: number
  rating: (typeof RATINGS)[number]
  path: string
  device: (typeof DEVICES)[number]
}

// "/dashboard/customer/orders/3f2a…?x=1" → "/dashboard/customer/orders/:id"
export function cleanPath(raw: string): string {
  const path = raw.split(/[?#]/)[0]
  const parts = path
    .split('/')
    .filter(Boolean)
    .slice(0, 6)
    .map((p) => (/^[0-9a-f-]{16,}$/i.test(p) || /\d{3,}/.test(p) || p.length > 40 ? ':id' : p.replace(/[^a-z0-9-]/gi, '')))
  return ('/' + parts.join('/')).slice(0, 100)
}

export function parseVital(body: unknown): Vital | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const name = VITAL_NAMES.find((n) => n === b.name)
  const rating = RATINGS.find((r) => r === b.rating)
  const device = DEVICES.find((d) => d === b.device)
  const value = typeof b.value === 'number' && Number.isFinite(b.value) && b.value >= 0 && b.value <= 600_000 ? b.value : null
  if (!name || !rating || !device || value == null || typeof b.path !== 'string' || !b.path.startsWith('/')) return null
  return { name, rating, device, value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value), path: cleanPath(b.path) }
}
