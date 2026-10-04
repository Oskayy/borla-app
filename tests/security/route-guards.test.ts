// F6: every API route must check who is calling. A new route without a guard fails here.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const API = path.resolve(__dirname, '../../app/api')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return name === 'route.ts' ? [full] : []
  })
}

// Routes reachable without a full login, and the guard each one must still contain.
const PUBLIC_ROUTES: Record<string, string[]> = {
  'auth/login': ['isRateLimited('],
  'auth/signup': ['isRateLimited(', 'SELF_SERVICE_ROLES'],
  'auth/request-reset': ['isRateLimited('],
  'auth/resend-confirmation': ['isRateLimited('],
  'auth/reset-password': ['auth.getUser()', 'enforceRateLimit('],
  'auth/mfa/enroll': ['auth.getUser()'],
  'auth/mfa/enroll/confirm': ['auth.getUser()', 'isRateLimited('],
  'auth/mfa/verify': ['auth.getUser()', 'isRateLimited('],
  'auth/mfa/unenroll': ['auth.getUser()', 'MANDATORY_MFA_ROLES'],
  'cron/dispatch': ['CRON_SECRET', 'timingSafeEqual'],
  'payments/webhook': ['x-paystack-signature', 'timingSafeEqual'],
}

const routes = routeFiles(API).map((file) => ({
  file,
  name: path.relative(API, path.dirname(file)).split(path.sep).join('/'),
  src: readFileSync(file, 'utf8'),
}))

describe('API route guards', () => {
  it('finds the API routes', () => {
    expect(routes.length).toBeGreaterThan(40)
  })

  for (const r of routes) {
    it(`${r.name} checks the caller`, () => {
      const publicGuards = PUBLIC_ROUTES[r.name]
      if (publicGuards) {
        for (const g of publicGuards) expect(r.src, `${r.name} should contain ${g}`).toContain(g)
      } else {
        expect(r.src, `${r.name} must call requireAuth(...) or be listed in PUBLIC_ROUTES with its guard`).toMatch(/requireAuth\(/)
      }
    })
  }

  it('every route under /api/admin requires a staff role list, never a bare login', () => {
    for (const r of routes.filter((x) => x.name.startsWith('admin/'))) {
      expect(r.src, r.name).not.toMatch(/requireAuth\(\s*\)/)
    }
  })

  it('every listed public route still exists', () => {
    const names = new Set(routes.map((r) => r.name))
    for (const name of Object.keys(PUBLIC_ROUTES)) expect(names.has(name), name).toBe(true)
  })
})
