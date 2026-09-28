// Picks the zone for a pickup point. Pure function (no database), so it can be unit-tested.
import { distanceInMeters } from './geo'

export interface ZoneCircle {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  priceMultiplier: number
}

// The zone whose circle contains the point. If circles overlap, the one whose centre is nearest.
// Returns null when the point is outside every zone.
export function pickZone<Z extends ZoneCircle>(zones: Z[], lat: number, lng: number): Z | null {
  let best: Z | null = null
  let bestKm = Infinity
  for (const z of zones) {
    if (z.centerLat == null || z.centerLng == null) continue
    const km = distanceInMeters(lat, lng, z.centerLat, z.centerLng) / 1000
    if (km <= z.radiusKm && km < bestKm) {
      best = z
      bestKm = km
    }
  }
  return best
}
