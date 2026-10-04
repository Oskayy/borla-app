// Plausibility checks on a driver's pickup proof (F4). They only FLAG a pickup for ops to look at on the
// Exceptions page; they never block it or hold the driver's pay. Pure functions so they can be tested.
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from './geo'

export const WEAK_GPS_ACCURACY_M = 100 // a reported accuracy worse than this can't confirm where the photo was taken
export const MAX_PLAUSIBLE_SPEED_KMH = 100 // faster than this between two pickups, in a city at night, is suspect
const SPEED_CHECK_MIN_METERS = 500 // ignore short hops, where GPS noise alone could look like speed
const SPEED_CHECK_WINDOW_MS = 6 * 3600_000 // only compare with a pickup earlier the same night

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
}

// Returns the problems found, in plain words (empty when all looks right).
export function pickupFlags(p: PickupProof): string[] {
  const flags: string[] = []
  if (!p.gps) {
    flags.push('no GPS position with the photo')
  } else {
    if (p.accuracyM != null && p.accuracyM > WEAK_GPS_ACCURACY_M) {
      flags.push(`weak GPS (accurate only to ~${Math.round(p.accuracyM)}m)`)
    }
    if (p.pin) {
      const off = distanceInMeters(p.pin.lat, p.pin.lng, p.gps.lat, p.gps.lng)
      if (off > GEOFENCE_THRESHOLD_METERS) flags.push(`GPS MISMATCH: photo taken ~${Math.round(off)}m from the pickup pin`)
    }
    if (p.previous) {
      const ms = p.at.getTime() - p.previous.at.getTime()
      const meters = distanceInMeters(p.previous.lat, p.previous.lng, p.gps.lat, p.gps.lng)
      if (ms > 0 && ms <= SPEED_CHECK_WINDOW_MS && meters >= SPEED_CHECK_MIN_METERS) {
        const kmh = meters / 1000 / (ms / 3600_000)
        if (kmh > MAX_PLAUSIBLE_SPEED_KMH) {
          flags.push(`moved ~${(meters / 1000).toFixed(1)} km in ${Math.max(1, Math.round(ms / 60_000))} min since the last pickup (~${Math.round(kmh)} km/h)`)
        }
      }
    }
  }
  if (p.photoUsedElsewhere) flags.push('the same photo was already used for another order')
  return flags
}
