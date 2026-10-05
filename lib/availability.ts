// Driver availability: the nights of the week a driver works, plus single nights off.
// A night is named by the date its shift starts (a Friday 8pm-6am shift is "Friday").
// Dispatch leaves a driver out on nights they are off; ops can still assign them by hand, with a warning.
// Pure functions (no database) so they can be tested.

import { addDays } from './shift'

export const ALL_NIGHTS = [0, 1, 2, 3, 4, 5, 6]
export const NIGHT_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MAX_DAYS_AHEAD = 60 // how far ahead a single night off can be booked
export const MAX_NIGHTS_OFF = 30

export interface Availability {
  workNights: number[]
  nightsOff: string[]
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

// 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD date.
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay()
}

export function worksNight(a: Availability, shiftDate: string): boolean {
  return a.workNights.includes(weekdayOf(shiftDate)) && !a.nightsOff.includes(shiftDate)
}

// The next nights from `fromDate` (inclusive) for the driver's "coming nights" list.
export function upcomingNights(a: Availability, fromDate: string, count: number): { date: string; working: boolean; weekly: boolean }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(fromDate, i)
    return { date, working: worksNight(a, date), weekly: a.workNights.includes(weekdayOf(date)) }
  })
}

// Checks what a driver sends. `today` is the current planning night; past nights off are dropped quietly.
export function parseAvailability(body: unknown, today: string): { ok: true; value: Availability } | { ok: false; error: string } {
  const b = body as { workNights?: unknown; nightsOff?: unknown } | null
  if (!Array.isArray(b?.workNights) || !b.workNights.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)) {
    return { ok: false, error: 'Choose the nights you work' }
  }
  const nightsOffIn = b.nightsOff ?? []
  if (!Array.isArray(nightsOffIn) || !nightsOffIn.every((d) => typeof d === 'string' && YMD.test(d) && !Number.isNaN(Date.parse(d)))) {
    return { ok: false, error: 'A night off has an invalid date' }
  }
  const last = addDays(today, MAX_DAYS_AHEAD)
  const nightsOff = [...new Set(nightsOffIn as string[])].filter((d) => d >= today).sort()
  if (nightsOff.some((d) => d > last)) return { ok: false, error: `Nights off can be up to ${MAX_DAYS_AHEAD} days ahead` }
  if (nightsOff.length > MAX_NIGHTS_OFF) return { ok: false, error: `Up to ${MAX_NIGHTS_OFF} single nights off at a time` }
  return { ok: true, value: { workNights: [...new Set(b.workNights as number[])].sort(), nightsOff } }
}

// Drop nights off that have passed (kept tidy whenever availability is saved or read).
export function pruneNightsOff(nightsOff: string[], today: string): string[] {
  return nightsOff.filter((d) => d >= today)
}
