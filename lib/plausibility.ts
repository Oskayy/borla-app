// Plausibility checks on a driver's pickup proof (F4). They FLAG a pickup for ops to look at on the Exceptions page;
// they never block it. Serious ones (photo far from the pin, impossible speed, a reused photo, a photo far from where
// the phone said it was) also hold the driver's pay for that order until ops have looked (lib/pickup-hold-server.ts).
// Pure functions so they can be tested.
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from './geo'

export const WEAK_GPS_ACCURACY_M = 100 // a reported accuracy worse than this can't confirm where the photo was taken
export const MAX_PLAUSIBLE_SPEED_KMH = 100 // faster than this between two pickups, in a city at night, is suspect
const SPEED_CHECK_MIN_METERS = 500 // ignore short hops, where GPS noise alone could look like speed
const SPEED_CHECK_WINDOW_MS = 6 * 3600_000 // only compare with a pickup earlier the same night
export const LIVE_MISMATCH_M = 1000 // photo position this far from the phone's live position at the time is suspect
const LIVE_WINDOW_MS = 5 * 60_000 // only compare with a live position sent within 5 minutes of the photo

// Text that marks a pickup for review in the audit log; the Exceptions page looks for it.
export const PICKUP_CHECK_MARKER = 'PICKUP CHECK'

interface Point {
  lat: number
  lng: number
}

export interface PickupProof {
  gps: Point | null // where the photo was taken, if the phone gave a position
  accuracyM: number | null
  pin: Point | null // the customer's pin
  previous: (Point & { at: Date }) | null // this driver's last pickup with a position
  at: Date
  photoUsedElsewhere: boolean // the same photo file was already used for another order
  live?: (Point & { at: Date }) | null // the phone's last live position (sent while online)
}

// Returns the problems found, in plain words (empty when all looks right).
export function pickupFlags(p: PickupProof): string[] {
  return pickupChecks(p).flags
}

// The problems found, and which of them are serious enough to hold the pay.
export function pickupChecks(p: PickupProof): { flags: string[]; serious: string[] } {
  const flags: string[] = []
  const serious: string[] = []
  const bad = (text: string) => {
    flags.push(text)
    serious.push(text)
  }
  if (!p.gps) {
    bad('no GPS position with the photo')
  } else {
    if (p.accuracyM != null && p.accuracyM > WEAK_GPS_ACCURACY_M) {
      flags.push(`weak GPS (accurate only to ~${Math.round(p.accuracyM)}m)`)
    }
    if (p.pin) {
      const off = distanceInMeters(p.pin.lat, p.pin.lng, p.gps.lat, p.gps.lng)
      if (off > GEOFENCE_THRESHOLD_METERS) bad(`GPS MISMATCH: photo taken ~${Math.round(off)}m from the pickup pin`)
    }
    if (p.live && Math.abs(p.at.getTime() - p.live.at.getTime()) <= LIVE_WINDOW_MS) {
      const off = distanceInMeters(p.live.lat, p.live.lng, p.gps.lat, p.gps.lng)
      if (off > LIVE_MISMATCH_M) bad(`photo position ~${(off / 1000).toFixed(1)} km from where the phone was at the time`)
    }
    if (p.previous) {
      const ms = p.at.getTime() - p.previous.at.getTime()
      const meters = distanceInMeters(p.previous.lat, p.previous.lng, p.gps.lat, p.gps.lng)
      if (ms > 0 && ms <= SPEED_CHECK_WINDOW_MS && meters >= SPEED_CHECK_MIN_METERS) {
        const kmh = meters / 1000 / (ms / 3600_000)
        if (kmh > MAX_PLAUSIBLE_SPEED_KMH) {
          bad(`moved ~${(meters / 1000).toFixed(1)} km in ${Math.max(1, Math.round(ms / 60_000))} min since the last pickup (~${Math.round(kmh)} km/h)`)
        }
      }
    }
  }
  if (p.photoUsedElsewhere) bad('the same photo was already used for another order')
  return { flags, serious }
}
