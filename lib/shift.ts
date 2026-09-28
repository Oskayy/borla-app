// Operating shift logic. Pure functions only (no database), so they can be unit-tested.
//
// Collection happens overnight, e.g. 20:00 -> 06:00. A shift is named by the date it STARTS:
// shiftDate 2026-09-28 means 28 Sept 20:00 until 29 Sept 06:00.
//
// Booking is open 24/7. Where an order lands depends on when it is paid (local time):
//   before the planning snapshot (18:00)      -> tonight's shift, planned batch
//   snapshot until the hard cutoff (00:00)    -> tonight's shift, late order (live dispatch)
//   after the hard cutoff                     -> the next night's shift, planned batch

export interface ShiftSettings {
  timezone: string
  shiftStartMinutes: number // e.g. 1200 = 20:00
  shiftEndMinutes: number // e.g. 360 = 06:00 (next morning)
  planningSnapshotMinutes: number // e.g. 1080 = 18:00
  hardCutoffMinutes: number // e.g. 0 = midnight
}

export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = {
  timezone: 'Africa/Accra',
  shiftStartMinutes: 20 * 60,
  shiftEndMinutes: 6 * 60,
  planningSnapshotMinutes: 18 * 60,
  hardCutoffMinutes: 0,
}

export interface BookingClassification {
  shiftDate: string // YYYY-MM-DD, the local date the shift starts
  isLate: boolean // true = joins a shift after its planning snapshot
  localDate: string // today's local date, for wording ("tonight" vs "tomorrow night")
}

const DAY = 24 * 60

// Local calendar date and minutes-after-midnight in the given time zone.
export function localParts(now: Date, timezone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const hour = Number(get('hour')) % 24
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  }
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

// True when the hard cutoff falls after midnight (e.g. 00:00 or 01:00),
// false when it falls before midnight (e.g. 23:00).
function cutoffIsAfterMidnight(s: ShiftSettings): boolean {
  return s.hardCutoffMinutes <= s.shiftEndMinutes
}

export function classifyBooking(now: Date, s: ShiftSettings): BookingClassification {
  const { date, minutes } = localParts(now, s.timezone)

  if (cutoffIsAfterMidnight(s)) {
    // Small hours before the cutoff still belong to last night's shift, as a late order.
    if (minutes < s.hardCutoffMinutes) return { shiftDate: addDays(date, -1), isLate: true, localDate: date }
    if (minutes < s.planningSnapshotMinutes) return { shiftDate: date, isLate: false, localDate: date }
    return { shiftDate: date, isLate: true, localDate: date }
  }

  // Cutoff before midnight (e.g. 23:00).
  if (minutes < s.planningSnapshotMinutes) return { shiftDate: date, isLate: false, localDate: date }
  if (minutes < s.hardCutoffMinutes) return { shiftDate: date, isLate: true, localDate: date }
  return { shiftDate: addDays(date, 1), isLate: false, localDate: date }
}

// "20:00" style input -> minutes. Returns null when invalid.
export function parseClock(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 1200 -> "8:00pm", 0 -> "12:00am (midnight)"
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const text = `${h12}:${String(m).padStart(2, '0')}${suffix}`
  return minutes === 0 ? `${text} (midnight)` : text
}

export function windowLabel(s: ShiftSettings): string {
  return `${formatClock(s.shiftStartMinutes)} – ${formatClock(s.shiftEndMinutes)}`
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// Customer-facing wording for when their pickup will happen.
export function describeCollection(shiftDate: string, localDate: string, s: ShiftSettings): string {
  const window = windowLabel(s)
  if (shiftDate === localDate) return `Tonight, between ${window}`
  if (shiftDate === addDays(localDate, 1)) return `Tomorrow night (${shortDate(shiftDate)}), between ${window}`
  if (shiftDate === addDays(localDate, -1)) return `Tonight's shift (already running), before ${formatClock(s.shiftEndMinutes)}`
  return `Night of ${shortDate(shiftDate)}, between ${window}`
}

// Returns an error message, or null when the settings make sense.
export function validateShiftSettings(s: ShiftSettings): string | null {
  const fields = [s.shiftStartMinutes, s.shiftEndMinutes, s.planningSnapshotMinutes, s.hardCutoffMinutes]
  if (fields.some((v) => !Number.isInteger(v) || v < 0 || v >= DAY)) return 'Times must be valid clock times'
  if (s.shiftStartMinutes <= s.shiftEndMinutes) return 'The shift must run overnight (start in the evening, end the next morning)'
  if (s.planningSnapshotMinutes >= s.shiftStartMinutes || s.planningSnapshotMinutes <= s.shiftEndMinutes) {
    return 'The planning snapshot must be after the shift ends and before the next shift starts'
  }
  const cutoffOk = s.hardCutoffMinutes >= s.shiftStartMinutes || s.hardCutoffMinutes <= s.shiftEndMinutes
  if (!cutoffOk) return 'The hard cutoff must fall during the shift (between its start and end)'
  if (!cutoffIsAfterMidnight(s) && s.hardCutoffMinutes <= s.planningSnapshotMinutes) {
    return 'The hard cutoff must be after the planning snapshot'
  }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: s.timezone })
  } catch {
    return 'Unknown time zone'
  }
  return null
}
