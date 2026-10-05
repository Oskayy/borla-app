// Driver availability: which nights a driver works, and dispatch leaving them out on nights off.
import { describe, expect, it } from 'vitest'
import { parseAvailability, upcomingNights, weekdayOf, worksNight } from '@/lib/availability'
import { assessDriver, type DispatchDriver } from '@/lib/dispatch'
import { pickReplacement } from '@/lib/reassign'

const weekdays = { workNights: [1, 2, 3, 4, 5], nightsOff: ['2026-10-07'] } // Mon-Fri, Wed 7 Oct off

describe('availability', () => {
  it('names nights by the date the shift starts', () => {
    expect(weekdayOf('2026-10-05')).toBe(1) // Monday
    expect(weekdayOf('2026-10-11')).toBe(0) // Sunday
  })

  it('works weekly nights, except single nights off', () => {
    expect(worksNight(weekdays, '2026-10-06')).toBe(true) // Tuesday
    expect(worksNight(weekdays, '2026-10-07')).toBe(false) // the night off
    expect(worksNight(weekdays, '2026-10-10')).toBe(false) // Saturday, not a working night
  })

  it('lists the coming nights from tonight', () => {
    const nights = upcomingNights(weekdays, '2026-10-06', 3)
    expect(nights.map((n) => [n.date, n.working, n.weekly])).toEqual([
      ['2026-10-06', true, true],
      ['2026-10-07', false, true],
      ['2026-10-08', true, true],
    ])
  })

  it('checks what the driver sends', () => {
    const today = '2026-10-05'
    expect(parseAvailability({ workNights: [5, 1, 1], nightsOff: ['2026-10-09', '2026-10-01'] }, today)).toEqual({
      ok: true,
      value: { workNights: [1, 5], nightsOff: ['2026-10-09'] }, // duplicates and past nights dropped
    })
    expect(parseAvailability({ workNights: [7] }, today).ok).toBe(false)
    expect(parseAvailability({ workNights: [1], nightsOff: ['tomorrow'] }, today).ok).toBe(false)
    expect(parseAvailability({ workNights: [1], nightsOff: ['2027-03-01'] }, today).ok).toBe(false) // too far ahead
    expect(parseAvailability(null, today).ok).toBe(false)
  })
})

describe('dispatch respects nights off', () => {
  const now = new Date('2026-10-05T21:00:00Z')
  const driver = (id: string, offNight: boolean): DispatchDriver => ({
    id,
    name: id,
    isActive: true,
    available: true,
    offNight,
    radiusKm: 10,
    capacityLitres: 1000,
    homeLat: 5.67,
    homeLng: -0.01,
    currentLat: 5.67,
    currentLng: -0.01,
    lastLocationAt: now,
    loadLitres: 0,
  })
  const order = { id: 'o1', latitude: 5.671, longitude: -0.011, litres: 60 }

  it('a driver off this night is not eligible, with a reason ops can see', () => {
    const fit = assessDriver(driver('d1', true), [order], true, now)
    expect(fit.eligible).toBe(false)
    expect(fit.counts).toBe(false)
    expect(fit.reasons).toContain('Off this night (their availability)')
    expect(assessDriver(driver('d2', false), [order], true, now).eligible).toBe(true)
  })

  it('also applies when planning ahead, before the shift starts', () => {
    expect(assessDriver(driver('d1', true), [order], false, now).eligible).toBe(false)
  })

  it('automatic reassignment skips drivers who are off', () => {
    expect(pickReplacement([driver('off', true), driver('on', false)], order, [], true, now).driver?.id).toBe('on')
    expect(pickReplacement([driver('off', true)], order, [], true, now).driver).toBeNull()
  })
})
