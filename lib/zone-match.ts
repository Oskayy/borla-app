// Picks the zone for a pickup point. Pure function (no database), so it can be unit-tested.
import { distanceInMeters } from './geo'
import { areaKm2, containsPoint, storedBoundary } from './zone-shape'

export interface ZoneCircle {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  priceMultiplier: number
  boundary?: unknown // the drawn outline (GeoJSON Polygon); when set it decides, not the circle
}

// The zone whose outline contains the point. Zones can't overlap (checked on save), but if two ever do, the
// smaller one wins, as the more specific area. A zone with no outline yet falls back to its circle; between
// circles the nearest centre wins, as before. Returns null when the point is outside every zone.
export function pickZone<Z extends ZoneCircle>(zones: Z[], lat: number, lng: number): Z | null {
  let best: Z | null = null
  let bestArea = Infinity
  for (const z of zones) {
    const shape = storedBoundary(z.boundary)
    if (!shape || !containsPoint(shape, lat, lng)) continue
    const km2 = areaKm2(shape)
    if (km2 < bestArea) {
      best = z
      bestArea = km2
    }
  }
  if (best) return best

  let bestKm = Infinity
  for (const z of zones) {
    if (storedBoundary(z.boundary) || z.centerLat == null || z.centerLng == null) continue
    const km = distanceInMeters(lat, lng, z.centerLat, z.centerLng) / 1000
    if (km <= z.radiusKm && km < bestKm) {
      best = z
      bestKm = km
    }
  }
  return best
}
