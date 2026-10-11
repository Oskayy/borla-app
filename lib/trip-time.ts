// Rough time estimates for a night's work, so ops and drivers know how long a trip takes and the planner
// doesn't give anyone more than fits in the shift. Pure functions (no database).
//
// A trip = drive from the start point to each stop in order, collect at each, drive to the disposal site, unload.
// Straight-line distances are stretched by ROAD_FACTOR to allow for real roads. Placeholders: adjust as real
// trip times come in.

import { distanceInMeters } from './geo'

export const STOP_MINUTES = 4 // park, collect the bins, photo, back on the road
export const NIGHT_SPEED_KMH = 20 // average speed on night roads, including slow turns into side streets
export const ROAD_FACTOR = 1.3 // roads are longer than a straight line
export const DEFAULT_UNLOAD_MINUTES = 15 // used when a site has no unload time set

export interface Point {
  lat: number
  lng: number
}

export function driveMinutes(a: Point, b: Point): number {
  const km = (distanceInMeters(a.lat, a.lng, b.lat, b.lng) / 1000) * ROAD_FACTOR
  return (km / NIGHT_SPEED_KMH) * 60
}

// Minutes for one trip. Stops without coordinates still count their collection time.
export function tripMinutes(
  start: Point | null,
  stops: (Point | null)[],
  site: (Point & { unloadMinutes?: number | null }) | null
): number {
  let total = 0
  let here = start
  for (const s of stops) {
    total += STOP_MINUTES
    if (!s) continue
    if (here) total += driveMinutes(here, s)
    here = s
  }
  if (site) {
    if (here) total += driveMinutes(here, site)
    total += site.unloadMinutes ?? DEFAULT_UNLOAD_MINUTES
  }
  return total
}

// "about 45 min", "about 1 h 20 min" (rounded to 5 minutes, never below 5).
export function durationLabel(minutes: number): string {
  const m = Math.max(5, Math.round(minutes / 5) * 5)
  if (m < 60) return `about ${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `about ${h} h ${rest} min` : `about ${h} h`
}

// Length of the shift in minutes (it crosses midnight: 8pm-6am is 600).
export function shiftLengthMinutes(startMinutes: number, endMinutes: number): number {
  return ((endMinutes - startMinutes + 1440) % 1440) || 1440
}
