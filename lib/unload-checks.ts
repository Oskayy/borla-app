// When an unload at a disposal site is paid straight away, and when it waits for ops. The phone's GPS alone can be
// faked, so a site can also post a code at its gate and/or ask for the weighbridge ticket number, and a share of
// automatic unloads is checked afterwards at random (the pay waits for that look). Pure functions so they can be tested.

export const GPS_TOLERANCE_M = 50 // extra metres on top of a site's geofence, because phone GPS drifts
export const CLEAN_RECORD_GEOFENCE_FACTOR = 2 // drivers with a clean record may be up to twice the site radius away
export const UNLOAD_AUDIT_RATE = 0.1 // share of automatic unloads that ops look at afterwards (placeholder)

export interface UnloadSite {
  geofenceRadiusM: number
  unloadCode: string | null
  ticketRequired: boolean
}

export interface UnloadProof {
  distanceM: number | null // photo to site, null without GPS
  code: string | null // what the driver typed
  ticket: string | null
  ticketUsedBefore: boolean // the same ticket number is already on another trip
  cleanRecord: boolean // lib/unload-checks-server.ts
}

// Codes are compared without case or spaces ("ab 12" = "AB12").
export function sameCode(a: string | null, b: string | null): boolean {
  const n = (s: string | null) => (s ?? '').replace(/\s+/g, '').toUpperCase()
  return !!a && n(a) !== '' && n(a) === n(b)
}

// null = paid now; otherwise why it waits for ops (shown to the driver and on the review page).
export function unloadNeedsReview(site: UnloadSite | null, p: UnloadProof): string | null {
  if (!site) return 'no disposal site was set for this trip'
  if (p.distanceM == null) return 'the photo had no GPS location'
  const allowed = site.geofenceRadiusM * (p.cleanRecord ? CLEAN_RECORD_GEOFENCE_FACTOR : 1) + GPS_TOLERANCE_M
  if (p.distanceM > allowed) return `the photo was ${p.distanceM} m from the site (allowed ${allowed} m)`
  if (site.unloadCode && !sameCode(site.unloadCode, p.code)) return p.code ? "the site code didn't match" : 'no site code was typed'
  if (site.ticketRequired && p.ticketUsedBefore) return 'that weighbridge ticket number was already used on another trip'
  return null
}

// A ticket number as typed: letters, digits, dashes and slashes, 3 to 30 characters; null if it isn't one.
export function parseTicket(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9 /-]{2,29}$/.test(t) ? t : null
}
