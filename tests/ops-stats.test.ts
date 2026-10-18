// The ops console's chart numbers: weekly rating trends, weekly counts, the star spread and masked phones.
import { describe, expect, it } from 'vitest'
import { maskPhone, starSpread, weeklyAverages, weeklyCounts } from '@/lib/ops-stats'

const now = new Date('2026-10-18T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)

describe('weeklyAverages', () => {
  it('averages each week, oldest first, and skips empty weeks', () => {
    const m = weeklyAverages(
      [
        { driverId: 'a', stars: 5, createdAt: daysAgo(30) },
        { driverId: 'a', stars: 3, createdAt: daysAgo(29) },
        { driverId: 'a', stars: 4, createdAt: daysAgo(2) },
        { driverId: 'b', stars: 2, createdAt: daysAgo(1) },
        { driverId: 'a', stars: 1, createdAt: daysAgo(60) }, // too old
      ],
      now
    )
    expect(m.get('a')).toEqual([4, 4])
    expect(m.get('b')).toEqual([2])
  })
})

describe('weeklyCounts', () => {
  it('counts per week with this week last', () => {
    const c = weeklyCounts([daysAgo(1), daysAgo(2), daysAgo(20), daysAgo(40)], now)
    expect(c.map((x) => x.value)).toEqual([0, 1, 0, 2])
    expect(c[3].label).toBe('This wk')
  })
})

describe('starSpread', () => {
  it('counts each star value from 5 down to 1', () => {
    expect(starSpread([5, 5, 4, 1])).toEqual([
      { stars: 5, count: 2 },
      { stars: 4, count: 1 },
      { stars: 3, count: 0 },
      { stars: 2, count: 0 },
      { stars: 1, count: 1 },
    ])
  })
})

describe('maskPhone', () => {
  it('shows only the start and the last three digits', () => {
    expect(maskPhone('0244123456')).toBe('024 •••• 456')
    expect(maskPhone('+233 24 412 3456')).toBe('024 •••• 456')
    expect(maskPhone('12')).toBe('•••')
    expect(maskPhone(null)).toBe('—')
  })
})
