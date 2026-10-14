import { describe, expect, it } from 'vitest'
import { bookingHint, shortClock, DEFAULT_SHIFT_SETTINGS, type ShiftSettings } from '@/lib/shift'

// Accra is UTC+0 all year, so these UTC times are the local times.
const live: ShiftSettings = { ...DEFAULT_SHIFT_SETTINGS, planningSnapshotMinutes: 19 * 60 }
const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00Z`)

describe('shortClock', () => {
  it('reads like a sentence', () => {
    expect(shortClock(19 * 60)).toBe('7pm')
    expect(shortClock(19 * 60 + 30)).toBe('7:30pm')
    expect(shortClock(6 * 60)).toBe('6am')
    expect(shortClock(12 * 60)).toBe('12pm')
    expect(shortClock(0)).toBe('midnight')
  })
})

describe('bookingHint', () => {
  it('uses the live snapshot time before it', () => {
    expect(bookingHint(at('15:00'), live)).toBe("Book by 7pm to join tonight's route. Late bookings until midnight.")
  })
  it('says late bookings are still collected tonight after the snapshot', () => {
    expect(bookingHint(at('21:00'), live)).toBe("Tonight's route is planned, but late bookings are still collected tonight until midnight.")
  })
  it('moves to tomorrow once a before-midnight cutoff has passed', () => {
    expect(bookingHint(at('23:30'), { ...live, hardCutoffMinutes: 23 * 60 })).toBe("Book now for tomorrow night's route.")
  })
})
