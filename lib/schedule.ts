// Which nightly jobs are due. Pure functions (no database) so they can be tested.
//
//  - Planning snapshot (e.g. 18:00): tell ops tonight's plan is ready to review.
//  - Shift start (e.g. 20:00): anything ops haven't approved is assigned automatically (if turned on),
//    and drivers are reminded to accept their stops.
//  - During the shift: new and bounced orders are assigned automatically every few minutes (if turned on).
//  - Shift end (e.g. 06:00): orders that weren't collected move to the next night.

import { addDays, localParts, type ShiftSettings } from './shift'
import { zonedInstant } from './offers'

function overnight(s: ShiftSettings): boolean {
  return s.shiftEndMinutes <= s.shiftStartMinutes
}

// The shift that is running now (named by the date it started), or null between shifts.
export function runningShiftDate(now: Date, s: ShiftSettings): string | null {
  const { date, minutes } = localParts(now, s.timezone)
  if (overnight(s)) {
    if (minutes >= s.shiftStartMinutes) return date
    if (minutes < s.shiftEndMinutes) return addDays(date, -1)
    return null
  }
  return minutes >= s.shiftStartMinutes && minutes < s.shiftEndMinutes ? date : null
}

// Between the planning snapshot and the shift start on the same evening: the date of tonight's shift.
export function snapshotWindowDate(now: Date, s: ShiftSettings): string | null {
  const { date, minutes } = localParts(now, s.timezone)
  return minutes >= s.planningSnapshotMinutes && minutes < s.shiftStartMinutes ? date : null
}

// The most recent shift that has finished (by its start date).
export function lastEndedShiftDate(now: Date, s: ShiftSettings): string {
  const { date } = localParts(now, s.timezone)
  const endOf = (d: string) => zonedInstant(overnight(s) ? addDays(d, 1) : d, s.shiftEndMinutes, s.timezone)
  let d = overnight(s) ? addDays(date, -1) : date
  if (now.getTime() < endOf(d).getTime()) d = addDays(d, -1)
  return d
}

// A date string (YYYY-MM-DD) as the UTC-midnight Date that Prisma uses for @db.Date columns.
export function dbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

// The night ops are planning for: the running shift, or (between shifts) the shift starting today.
export function planningShiftDate(now: Date, s: ShiftSettings): string {
  return runningShiftDate(now, s) ?? localParts(now, s.timezone).date
}

// Orders that belong to that night or earlier (not ones already booked for a later night).
export function plannableOrderFilter(now: Date, s: ShiftSettings) {
  return { OR: [{ shiftDate: { lte: dbDate(planningShiftDate(now, s)) } }, { shiftDate: null }] }
}
