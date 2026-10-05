// Customer ratings and the driver's own analytics. Pure functions (no database) so they can be tested.

// Orders the customer can rate: the driver has collected the bins.
export const RATEABLE_STATUSES = ['PICKED_UP', 'DISPOSAL_PENDING', 'DISPOSAL_VERIFIED', 'COMPLETED']
export const RATING_WINDOW_DAYS = 14 // after the pickup
export const LOW_RATING = 2 // this many stars or fewer goes to ops
export const MAX_COMMENT = 500
export const STATS_DAYS = 30 // the driver's analytics look back this far

export function canRate(order: { status: string; driverId: string | null }, pickedUpAt: Date | null, now: Date): boolean {
  if (!order.driverId || !RATEABLE_STATUSES.includes(order.status)) return false
  if (!pickedUpAt) return true
  return now.getTime() - pickedUpAt.getTime() <= RATING_WINDOW_DAYS * 86_400_000
}

export function parseRating(body: unknown): { ok: true; stars: number; comment: string | null } | { ok: false; error: string } {
  const b = body as { stars?: unknown; comment?: unknown } | null
  const stars = b?.stars
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: 'Choose from 1 to 5 stars' }
  }
  if (b?.comment != null && typeof b.comment !== 'string') return { ok: false, error: 'Invalid comment' }
  const comment = typeof b?.comment === 'string' ? b.comment.replace(/\s+/g, ' ').trim() : ''
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Keep the comment under ${MAX_COMMENT} characters` }
  return { ok: true, stars, comment: comment || null }
}

export interface RatingSummary {
  count: number
  average: number | null // to one decimal place
  byStars: number[] // index 0 = 1 star ... index 4 = 5 stars
}

export function summarizeRatings(stars: number[]): RatingSummary {
  const byStars = [0, 0, 0, 0, 0]
  for (const s of stars) if (s >= 1 && s <= 5) byStars[s - 1]++
  const count = byStars.reduce((a, b) => a + b, 0)
  const total = byStars.reduce((sum, n, i) => sum + n * (i + 1), 0)
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null, byStars }
}

export interface StopCounts {
  accepted: number // stops the driver accepted
  declined: number
  expired: number // the accept time ran out
  collected: number // pickups confirmed
  notCollected: number // still on the list at shift end
}

export interface DriverStats extends StopCounts {
  offered: number
  acceptanceRate: number | null // accepted / offered, as a whole percent
  completionRate: number | null // collected / (collected + not collected), as a whole percent
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)

export function driverStats(c: StopCounts): DriverStats {
  const offered = c.accepted + c.declined + c.expired
  return {
    ...c,
    offered,
    acceptanceRate: pct(c.accepted, offered),
    completionRate: pct(c.collected, c.collected + c.notCollected),
  }
}

export const MISS_LABELS: Record<string, string> = {
  DECLINED: 'Declined',
  EXPIRED: 'Not answered in time',
  NOT_COLLECTED: 'Not collected',
}
