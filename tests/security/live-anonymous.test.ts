// F6, live: calls every API route without logging in and expects a refusal, never data or a crash.
// Runs only when TEST_BASE_URL is set (e.g. TEST_BASE_URL=http://localhost:3000 npm test).
// Safe against any server: signed-out requests can't change anything.
import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.TEST_BASE_URL
const API = path.resolve(__dirname, '../../app/api')
const DUMMY_ID = '11111111-1111-4111-8111-111111111111'

// The login flow answers signed-out callers by design; its routes are guarded by rate limits instead.
// The price check before signing up is public too (saves nothing, limited per IP; see route-guards.test.ts).
const LOGIN_FLOW = ['auth/login', 'auth/signup', 'auth/request-reset', 'auth/resend-confirmation', 'pricing/quote-public']

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return routes(full)
    return name === 'route.ts' ? [path.relative(API, dir).split(path.sep).join('/')] : []
  })
}

describe.skipIf(!BASE)('signed-out access to every API route', () => {
  for (const r of routes(API).filter((x) => !LOGIN_FLOW.includes(x))) {
    const url = `${BASE}/api/${r.replace(/\[[^\]]+\]/g, DUMMY_ID)}`
    for (const method of ['GET', 'POST']) {
      it(`${method} /api/${r} is refused`, async () => {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method === 'POST' ? '{}' : undefined,
          redirect: 'manual',
        })
        // 401/403 = refused; 405 = method not offered; 307 = sent to login. Never 200 with data, never a 500.
        expect([401, 403, 405, 307], `${method} ${r} answered ${res.status}`).toContain(res.status)
      }, 60_000)
    }
  }
})
