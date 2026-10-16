// When a driver's photo was taken. The driver app keeps a pickup or unload on the phone while there is no signal and
// sends it later, so the server records the time the photo was taken, not when it arrived: otherwise two pickups sent
// together would look like an impossible drive between them. The phone's clock is only trusted within limits: never in
// the future (2 minutes' grace for clock drift) and never more than 12 hours back (one shift). Anything else, or
// nothing, means "now". Only evidence records and the pickup checks use this; money timings never do.

export const TAKEN_AT_MAX_AGE_HOURS = 12
const FUTURE_GRACE_MS = 2 * 60_000

export function parseTakenAt(value: unknown, now: Date = new Date()): Date {
  if (typeof value !== 'string' || value.length > 40) return now
  const t = Date.parse(value)
  if (!Number.isFinite(t)) return now
  if (t > now.getTime() + FUTURE_GRACE_MS) return now
  if (t < now.getTime() - TAKEN_AT_MAX_AGE_HOURS * 3600_000) return now
  return new Date(Math.min(t, now.getTime()))
}

// Minutes between the photo and its arrival, for ops ("sent 25 min after the photo"), or 0 when it came straight away.
export function minutesLate(takenAt: Date, now: Date = new Date()): number {
  const m = Math.floor((now.getTime() - takenAt.getTime()) / 60_000)
  return m >= 5 ? m : 0
}
