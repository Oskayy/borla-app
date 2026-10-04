// F6, live: one customer can't see or change another customer's orders, and customers and drivers can't use
// staff routes. Needs two test customers and one test driver on a STAGING Supabase project (never live data,
// see CLAUDE.md). Set TEST_BASE_URL, TEST_CUSTOMER_A, TEST_CUSTOMER_B, TEST_DRIVER (each "email:password")
// and TEST_ORDER_OF_B (an order id owned by customer B), then run: npm test
import { describe, expect, it } from 'vitest'

const BASE = process.env.TEST_BASE_URL
const A = process.env.TEST_CUSTOMER_A
const B_ORDER = process.env.TEST_ORDER_OF_B
const DRIVER = process.env.TEST_DRIVER
const ready = !!(BASE && A && process.env.TEST_CUSTOMER_B && B_ORDER && DRIVER)

async function login(cred: string): Promise<string> {
  const i = cred.indexOf(':')
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cred.slice(0, i), password: cred.slice(i + 1) }),
  })
  expect(res.status).toBe(200)
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

async function call(cookie: string, method: string, p: string, body?: unknown) {
  return fetch(`${BASE}${p}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })
}

describe.skipIf(!ready)('cross-account access', () => {
  it("customer A can't pay for, cancel, delete or view customer B's order", async () => {
    const a = await login(A!)
    const attempts: [string, unknown][] = [
      ['/api/payments/initialize', { orderId: B_ORDER }],
      ['/api/orders/cancel', { orderId: B_ORDER, reason: 'test' }],
      ['/api/orders/delete-draft', { orderId: B_ORDER }],
      ['/api/orders/add-evidence', { orderId: B_ORDER, photoPath: `${B_ORDER}/x.jpg` }],
    ]
    for (const [p, body] of attempts) {
      const res = await call(a, 'POST', p, body)
      expect([400, 403, 404], `${p} answered ${res.status}`).toContain(res.status)
    }
    const page = await call(a, 'GET', `/dashboard/customer/orders/${B_ORDER}`)
    expect([307, 404]).toContain(page.status)
  }, 60_000)

  it("a customer can't use driver or staff routes", async () => {
    const a = await login(A!)
    for (const p of ['/api/driver/withdrawals', '/api/orders/confirm-pickup', '/api/admin/staff', `/api/admin/orders/${B_ORDER}/refund`]) {
      expect((await call(a, 'POST', p, {})).status, p).toBe(403)
    }
  }, 60_000)

  it("a driver can't use staff routes or confirm someone else's stop", async () => {
    const d = await login(DRIVER!)
    for (const p of [`/api/admin/withdrawals/${B_ORDER}`, '/api/admin/staff', '/api/orders/manual-assign']) {
      expect((await call(d, 'POST', p, {})).status, p).toBe(403)
    }
    const res = await call(d, 'POST', '/api/orders/confirm-pickup', { orderId: B_ORDER, photoPath: `${B_ORDER}/x.jpg` })
    expect([400, 404]).toContain(res.status)
  }, 60_000)
})
