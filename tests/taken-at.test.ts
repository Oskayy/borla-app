// Pickups and unloads sent late (no signal at the time) keep the time the photo was taken, within limits.
import { describe, expect, it } from 'vitest'
import { minutesLate, parseTakenAt } from '@/lib/taken-at'

const now = new Date('2026-10-15T22:00:00Z')
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

describe('parseTakenAt', () => {
  it('keeps a photo time from earlier in the shift', () => {
    expect(parseTakenAt(minsAgo(40), now).toISOString()).toBe(minsAgo(40))
  })
  it('falls back to now when missing or not a date', () => {
    for (const v of [undefined, null, 42, '', 'yesterday', 'x'.repeat(60)]) expect(parseTakenAt(v, now)).toEqual(now)
  })
  it('never accepts a time in the future, allowing a little clock drift', () => {
    expect(parseTakenAt(new Date(now.getTime() + 60_000).toISOString(), now)).toEqual(now)
    expect(parseTakenAt(new Date(now.getTime() + 10 * 60_000).toISOString(), now)).toEqual(now)
  })
  it('never goes back more than 12 hours', () => {
    expect(parseTakenAt(minsAgo(11 * 60), now).toISOString()).toBe(minsAgo(11 * 60))
    expect(parseTakenAt(minsAgo(13 * 60), now)).toEqual(now)
  })
})

describe('minutesLate', () => {
  it('is 0 for anything sent within 5 minutes', () => {
    expect(minutesLate(new Date(minsAgo(4)), now)).toBe(0)
  })
  it('counts the minutes for a late send', () => {
    expect(minutesLate(new Date(minsAgo(25)), now)).toBe(25)
  })
})
