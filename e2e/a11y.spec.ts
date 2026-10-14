import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Automated accessibility checks (Frontend plan, phase 1): every main page, in light and dark mode, must have
// no serious or critical axe-core problems against WCAG 2.2 A and AA. Smaller problems are printed, not failed.
// Customer and driver pages sign in with the git-ignored tests/.test-accounts.local.json and are skipped without it.
// Ops pages need a 2FA code, so they aren't covered here yet. Automated checks find only part of the problems:
// keyboard, screen-reader and real-user checks stay in the plan.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const THEMES = ['light', 'dark'] as const

type Account = { email: string; password: string }
function testAccount(role: 'customer' | 'driver'): Account | null {
  try {
    const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', '.test-accounts.local.json'), 'utf8'))
    const a = all?.[role]
    return a?.email && a?.password ? { email: a.email, password: a.password } : null
  } catch {
    return null
  }
}

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('trashit-theme', t)
      localStorage.setItem('borla_cookie_consent', 'essential-only') // keep the cookie banner out of the way
    } catch {}
  }, theme)
}

async function check(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  // Maps keep loading tiles, so the network may never go quiet: wait a little, then check what has rendered.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  const result = await new AxeBuilder({ page })
    .withTags(TAGS)
    .exclude('.mapboxgl-map') // third-party map canvas
    .analyze()
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const minor = result.violations.filter((v) => !serious.includes(v))
  for (const v of minor) console.log(`[a11y] ${url} (${v.impact}): ${v.id} on ${v.nodes.length} element(s)`)
  const report = serious.map((v) => `${v.impact}: ${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`)
  expect(report, `${url}: serious accessibility problems`).toEqual([])
}

async function signIn(page: Page, account: Account) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  // Wait until the form is live, or React resets what was typed while it loaded.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  const email = page.getByLabel('Email')
  await expect(async () => {
    await email.fill(account.email)
    await expect(email).toHaveValue(account.email, { timeout: 1_000 })
  }).toPass({ timeout: 30_000 })
  await page.locator('#password').fill(account.password)
  // A cold dev server compiles the sign-in route on first use and can fail that first try: try again once.
  for (let attempt = 1; ; attempt++) {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    const ok = await page.waitForURL(/\/dashboard/, { timeout: 45_000 }).then(
      () => true,
      () => false
    )
    if (ok) return
    if (attempt >= 2) throw new Error('Could not sign in as the test account')
  }
}

const PUBLIC = ['/', '/book', '/login', '/signup', '/privacy-policy', '/terms', '/refund-policy', '/cookie-policy']
const CUSTOMER = ['/dashboard/customer', '/dashboard/customer/book', '/dashboard/customer/orders', '/dashboard/customer/settings']
const DRIVER = ['/dashboard/driver', '/dashboard/driver/earnings', '/dashboard/driver/account']

for (const theme of THEMES) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme))

    for (const url of PUBLIC) {
      test(`public ${url}`, async ({ page }) => check(page, url))
    }

    test('customer pages', async ({ page }) => {
      const account = testAccount('customer')
      test.skip(!account, 'no test customer in tests/.test-accounts.local.json')
      await signIn(page, account!)
      for (const url of CUSTOMER) await check(page, url)
    })

    test('driver pages', async ({ page }) => {
      const account = testAccount('driver')
      test.skip(!account, 'no test driver in tests/.test-accounts.local.json')
      await signIn(page, account!)
      for (const url of DRIVER) await check(page, url)
    })
  })
}
