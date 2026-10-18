// Default price multiplier per zone tier ("tier prices", phase D). A zone either follows its tier (its multiplier is
// kept equal to the tier's) or has its own number. Pure functions; lib/tier-price-server.ts reads and saves them.

import type { ZoneTier } from '@prisma/client'
import { inRange } from './numbers'

export type TierPrices = Record<ZoneTier, number>

export const TIER_LIST: ZoneTier[] = ['PREMIUM', 'STANDARD', 'BASIC']
export const MULTIPLIER_MIN = 0.5
export const MULTIPLIER_MAX = 5
export const DEFAULT_TIER_PRICES: TierPrices = { PREMIUM: 1, STANDARD: 1, BASIC: 1 }

export const tierLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase()

// Multipliers are kept to two decimals (x1.25), so a typed 1.2499999 can't creep in.
const twoDp = (n: number) => Math.round(n * 100) / 100

// A body like { PREMIUM: 1.3, STANDARD: 1, BASIC: 0.85 }: every tier is needed, each 0.5 to 5.
export function parseTierPrices(body: unknown): TierPrices | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const out = {} as TierPrices
  for (const t of TIER_LIST) {
    const n = inRange(b[t], MULTIPLIER_MIN, MULTIPLIER_MAX)
    if (n === null) return { error: `The ${tierLabel(t)} multiplier must be between ${MULTIPLIER_MIN} and ${MULTIPLIER_MAX}` }
    out[t] = twoDp(n)
  }
  return out
}

// A zone's multiplier after a save: a new zone, or one that follows its tier, takes the (new) tier's price; a zone
// with its own number keeps it.
export function zoneMultiplierAfter(before: { followsTier: boolean; priceMultiplier: number } | null, tier: ZoneTier, prices: TierPrices): number {
  if (!before || before.followsTier) return prices[tier]
  return before.priceMultiplier
}

export function parseOwnMultiplier(value: unknown): number | null {
  const n = inRange(value, MULTIPLIER_MIN, MULTIPLIER_MAX)
  return n === null ? null : twoDp(n)
}
