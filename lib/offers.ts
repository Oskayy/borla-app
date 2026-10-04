// How long a driver has to accept a stop. Pure functions (no database) so they can be tested.
//
// The clock starts when the stop is given to the driver, but never before the shift the order belongs to
// starts: stops planned at 6pm can be accepted any time before the shift, and only expire once the shift is
// running and the driver still hasn't answered.

import { localParts } from './shift'

export const MIN_ACCEPT_MINUTES = 5
export const MAX_ACCEPT_MINUTES = 120

// The UTC instant of a local date + minutes-after-midnight in a time zone.
export function zonedInstant(ymd: string, minutes: number, timezone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60)
  // Work out the zone's offset at that moment and correct for it (twice, in case the offset changes).
  let t = guess
  for (let i = 0; i < 2; i++) {
    const local = localParts(new Date(t), timezone)
    const [ly, lm, ld] = local.date.split('-').map(Number)
    const localAsUtc = Date.UTC(ly, lm - 1, ld, Math.floor(local.minutes / 60), local.minutes % 60)
    t = t + (guess - localAsUtc)
  }
  return new Date(t)
}

export function offerDeadline(
  offeredAt: Date,
  shiftDate: Date | string | null, // the order's shift (a date), if known
  shiftStartMinutes: number,
  timezone: string,
  acceptMinutes: number
): Date {
  let clockStart = offeredAt.getTime()
  if (shiftDate) {
    const ymd = typeof shiftDate === 'string' ? shiftDate.slice(0, 10) : shiftDate.toISOString().slice(0, 10)
    const shiftStart = zonedInstant(ymd, shiftStartMinutes, timezone).getTime()
    clockStart = Math.max(clockStart, shiftStart)
  }
  return new Date(clockStart + acceptMinutes * 60_000)
}

export function isOfferExpired(deadline: Date, now: Date): boolean {
  return now.getTime() >= deadline.getTime()
}

// "12 min" / "1 h 5 min" / "now"
export function describeTimeLeft(deadline: Date, now: Date): string {
  const mins = Math.ceil((deadline.getTime() - now.getTime()) / 60_000)
  if (mins <= 0) return 'now'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

export function newStopsMessage(count: number, acceptMinutes: number): { title: string; body: string; url: string } {
  return {
    title: count === 1 ? 'New stop for you' : `${count} new stops for you`,
    body: `Open Trashit to accept or decline. Once the shift is running you have ${acceptMinutes} min, then unanswered stops go to another driver.`,
    url: '/dashboard/driver',
  }
}
