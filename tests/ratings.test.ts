// Customer ratings and driver analytics: who can rate, what is accepted, and the numbers drivers see.
import { describe, expect, it } from 'vitest'
import { canRate, driverStats, parseRating, summarizeRatings, RATING_WINDOW_DAYS } from '@/lib/ratings'

const now = new Date('2026-10-20T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)

describe('who can rate', () => {
  it('only collected pickups with a driver', () => {
    expect(canRate({ status: 'COMPLETED', driverId: 'd1' }, daysAgo(1), now)).toBe(true)
    expect(canRate({ status: 'PICKED_UP', driverId: 'd1' }, daysAgo(0), now)).toBe(true)
    expect(canRate({ status: 'ASSIGNED', driverId: 'd1' }, null, now)).toBe(false)
    expect(canRate({ status: 'CANCELLED', driverId: 'd1' }, null, now)).toBe(false)
    expect(canRate({ status: 'COMPLETED', driverId: null }, daysAgo(1), now)).toBe(false)
  })

  it(`closes ${RATING_WINDOW_DAYS} days after the pickup`, () => {
    expect(canRate({ status: 'COMPLETED', driverId: 'd1' }, daysAgo(RATING_WINDOW_DAYS - 1), now)).toBe(true)
    expect(canRate({ status: 'COMPLETED', driverId: 'd1' }, daysAgo(RATING_WINDOW_DAYS + 1), now)).toBe(false)
  })
})

describe('what a customer sends', () => {
  it('accepts 1-5 whole stars and tidies the comment', () => {
    expect(parseRating({ stars: 4, comment: '  On time,\n  thank you ' })).toEqual({ ok: true, stars: 4, comment: 'On time, thank you' })
    expect(parseRating({ stars: 5 })).toEqual({ ok: true, stars: 5, comment: null })
    expect(parseRating({ stars: 3, comment: '   ' })).toEqual({ ok: true, stars: 3, comment: null })
  })

  it('refuses anything else', () => {
    expect(parseRating({ stars: 0 }).ok).toBe(false)
    expect(parseRating({ stars: 6 }).ok).toBe(false)
    expect(parseRating({ stars: 4.5 }).ok).toBe(false)
    expect(parseRating({ stars: '5' }).ok).toBe(false)
    expect(parseRating({ stars: 5, comment: 42 }).ok).toBe(false)
    expect(parseRating({ stars: 5, comment: 'x'.repeat(501) }).ok).toBe(false)
    expect(parseRating(null).ok).toBe(false)
  })
})

describe('driver numbers', () => {
  it('averages ratings to one decimal place', () => {
    expect(summarizeRatings([5, 4, 4, 1])).toEqual({ count: 4, average: 3.5, byStars: [1, 0, 0, 2, 1] })
    expect(summarizeRatings([])).toEqual({ count: 0, average: null, byStars: [0, 0, 0, 0, 0] })
  })

  it('works out acceptance and completion', () => {
    const s = driverStats({ accepted: 18, declined: 1, expired: 1, collected: 17, notCollected: 1 })
    expect(s.offered).toBe(20)
    expect(s.acceptanceRate).toBe(90)
    expect(s.completionRate).toBe(94)
  })

  it('shows no rate rather than 0% when there is nothing to count', () => {
    const s = driverStats({ accepted: 0, declined: 0, expired: 0, collected: 0, notCollected: 0 })
    expect(s.acceptanceRate).toBeNull()
    expect(s.completionRate).toBeNull()
  })
})
