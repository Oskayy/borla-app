// How long personal data is kept (privacy policy section 6, decided Oct 2026). The nightly cleanup
// (lib/retention-server.ts) deletes what has passed these limits.

export const PHOTO_MONTHS = 12 // pickup, unload and placement photos (and the GPS stamped on them), after the order is finished
export const PIN_MONTHS = 12 // the pin and address on a finished order
export const NOTIFICATION_DAYS = 90 // in-app alerts
export const DRAFT_DAYS = 30 // bookings that were never paid
export const RECORDS_YEARS = 6 // orders, payments, payouts and the ledger (tax and accounting records). Never deleted
// automatically: deleting them after 6 years needs an admin to approve it (decided Oct 2026; not built yet).

// Switched on 13 Oct 2026 after a dry run (nothing was due yet).
export const RETENTION_CLEANUP_ON = true

// Orders in these states are finished; nothing more can happen to them.
export const FINISHED_STATUSES = ['COMPLETED', 'CANCELLED'] as const
// While any of these is open on an order, its evidence and pin are kept whatever their age.
export const OPEN_REFUND_STATUSES = ['AWAITING_APPROVAL', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION']
export const RETENTION_BATCH = 500 // per run; the rest goes on the next nights

export function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d
}

export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000)
}

// One photo file can be shared by several orders (a trip's unload photo). A file is removed only when every
// evidence row pointing at it is being removed.
export function filesToRemove(expiringPaths: string[], stillUsed: Iterable<string>): string[] {
  const keep = new Set(stillUsed)
  return [...new Set(expiringPaths)].filter((p) => p && !keep.has(p))
}
