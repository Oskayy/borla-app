// Is a driver really there to take work? Pure functions (no database) so they can be tested.
//
// Tapping "Go online" isn't enough on its own (a driver who closed the app last night still looked online). A driver
// counts for new stops only when all of these hold:
//  - they switched online, during the shift or with an ops override (lib/shift.ts isDriverAvailable);
//  - their phone sent a location in the last LIVE_LOCATION_MAX_AGE_MINUTES;
//  - that location is inside their working zone, or within NEAR_ZONE_KM of its edge. A driver with no zone works
//    around their home base: within their radius, plus the same margin.
// Stops they already have are not affected; they just aren't offered new ones until they're back.

import { distanceInMeters } from './geo'
import { LIVE_LOCATION_MAX_AGE_MINUTES } from './dispatch'
import { isDriverAvailable, type ShiftSettings } from './shift'
import { distanceToShapeKm, storedBoundary } from './zone-shape'

export const NEAR_ZONE_KM = 3 // how far outside their area a driver still counts (on the way in, a road on the edge)

export interface PresenceInput {
  isOnline: boolean
  onlineOverrideUntil: Date | null
  currentLat: number | null
  currentLng: number | null
  lastLocationAt: Date | string | null
  homeLat: number | null
  homeLng: number | null
  radiusKm: number | null
  zone?: { name: string; boundary: unknown } | null
}

export type PresenceState = 'offline' | 'no_location' | 'stale_location' | 'away' | 'present'

export interface Presence {
  state: PresenceState
  available: boolean // counts for new stops
  reason: string // plain words for ops and the driver ('' when present)
  kmAway: number | null // how far outside their area (away only)
}

const km1 = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)))

export function driverPresence(p: PresenceInput, now: Date, s: ShiftSettings): Presence {
  if (!isDriverAvailable(p, now, s)) return { state: 'offline', available: false, reason: 'Offline', kmAway: null }
  if (p.currentLat == null || p.currentLng == null || !p.lastLocationAt) {
    return { state: 'no_location', available: false, reason: 'Online, but no location from their phone yet', kmAway: null }
  }
  const ageMin = Math.floor((now.getTime() - new Date(p.lastLocationAt).getTime()) / 60_000)
  if (ageMin > LIVE_LOCATION_MAX_AGE_MINUTES) {
    return { state: 'stale_location', available: false, reason: `Online, but no location for ${ageMin} min`, kmAway: null }
  }

  const shape = storedBoundary(p.zone?.boundary)
  if (shape) {
    const out = distanceToShapeKm(shape, p.currentLat, p.currentLng)
    if (out > NEAR_ZONE_KM) {
      return { state: 'away', available: false, reason: `Online, but ${km1(out)} km outside ${p.zone!.name}`, kmAway: out }
    }
  } else if (p.homeLat != null && p.homeLng != null && p.radiusKm != null) {
    const out = distanceInMeters(p.homeLat, p.homeLng, p.currentLat, p.currentLng) / 1000 - p.radiusKm
    if (out > NEAR_ZONE_KM) {
      return { state: 'away', available: false, reason: `Online, but ${km1(out)} km outside their working area`, kmAway: out }
    }
  }
  return { state: 'present', available: true, reason: '', kmAway: null }
}

// What the driver's own screen says when they are online but not counted.
export function presenceHint(pr: Presence): string | null {
  switch (pr.state) {
    case 'no_location':
    case 'stale_location':
      return "We aren't getting your location, so you won't be offered new stops. Keep Trashit open with location on."
    case 'away':
      return `You're ${km1(pr.kmAway ?? 0)} km outside your working area. New stops come once you're within ${NEAR_ZONE_KM} km of it.`
    default:
      return null
  }
}

// The fields to read for driverPresence (a Prisma select on DriverProfile).
export const PRESENCE_SELECT = {
  isOnline: true,
  onlineOverrideUntil: true,
  currentLat: true,
  currentLng: true,
  lastLocationAt: true,
  homeLat: true,
  homeLng: true,
  radiusKm: true,
  zone: { select: { name: true, boundary: true } },
} as const
