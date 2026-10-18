// Tier prices (phase D): checking what Finance types, and which multiplier a zone gets when it is saved.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseOwnMultiplier, parseTierPrices, zoneMultiplierAfter } from '@/lib/tier-price'

const prices = { PREMIUM: 1.3, STANDARD: 1, BASIC: 0.85 }
const src = (f: string) => readFileSync(path.resolve(__dirname, '..', f), 'utf8')

describe('parseTierPrices', () => {
  it('takes all three tiers, as numbers or typed text, to two decimals', () => {
    expect(parseTierPrices({ PREMIUM: '1.3', STANDARD: 1, BASIC: 0.8499999 })).toEqual(prices)
  })

  it('refuses a missing tier, out-of-range values and junk', () => {
    expect(parseTierPrices({ PREMIUM: 1.3, STANDARD: 1 })).toEqual({ error: 'The Basic multiplier must be between 0.5 and 5' })
    expect('error' in parseTierPrices({ PREMIUM: 6, STANDARD: 1, BASIC: 1 })).toBe(true)
    expect('error' in parseTierPrices({ PREMIUM: 0.2, STANDARD: 1, BASIC: 1 })).toBe(true)
    expect('error' in parseTierPrices({ PREMIUM: 'lots', STANDARD: 1, BASIC: 1 })).toBe(true)
    expect('error' in parseTierPrices({ PREMIUM: NaN, STANDARD: 1, BASIC: 1 })).toBe(true)
    expect('error' in parseTierPrices(null)).toBe(true)
  })

  it('own prices follow the same range', () => {
    expect(parseOwnMultiplier('1.234')).toBe(1.23)
    expect(parseOwnMultiplier(0.4)).toBeNull()
    expect(parseOwnMultiplier('')).toBeNull()
  })
})

describe('zoneMultiplierAfter', () => {
  it('a new zone takes its tier price', () => {
    expect(zoneMultiplierAfter(null, 'PREMIUM', prices)).toBe(1.3)
  })

  it('a zone that follows its tier takes the new tier price when its tier changes', () => {
    expect(zoneMultiplierAfter({ followsTier: true, priceMultiplier: 1 }, 'BASIC', prices)).toBe(0.85)
  })

  it('a zone with its own price keeps it, whatever its tier', () => {
    expect(zoneMultiplierAfter({ followsTier: false, priceMultiplier: 1.2 }, 'BASIC', prices)).toBe(1.2)
  })
})

describe('who can change prices', () => {
  it('tier prices and zone prices need Super Admin or Finance', () => {
    for (const f of ['app/api/admin/tier-prices/route.ts', 'app/api/admin/zones/[id]/multiplier/route.ts']) {
      const s = src(f)
      expect(s, f).toContain("const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']")
      expect(s, f).toContain('requireAuth(FINANCE_ROLES)')
    }
  })

  it('an Ops Manager changing a tier that changes a price is refused when saving a zone', () => {
    const s = src('lib/zone-save-server.ts')
    expect(s).toContain("before.priceMultiplier !== multiplier && actorRole !== 'SUPER_ADMIN'")
    for (const f of ['app/api/admin/zones/route.ts', 'app/api/admin/zones/[id]/route.ts']) expect(src(f), f).toContain('actorRole: auth.dbUser.role')
  })

  it('the migration changes no price: defaults 1.0 and existing zones keep their own number', () => {
    const sql = src('prisma/migrations/20261019120000_tier_prices/migration.sql')
    expect(sql).toContain(`VALUES ('PREMIUM', 1.0), ('STANDARD', 1.0), ('BASIC', 1.0)`)
    expect(sql).toContain('ADD COLUMN "followsTier" BOOLEAN NOT NULL DEFAULT false')
    expect(sql).not.toMatch(/UPDATE "Zone"/)
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
  })
})
