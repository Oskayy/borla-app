import { prisma } from '@/lib/prisma'
import { storedBoundary } from '@/lib/zone-shape'

// Content for the public landing page. Only true facts go here.

// Proof strip and testimonial: the layout keeps their place, but they stay hidden until real figures and real,
// permitted customer quotes exist. Add entries here when they do (e.g. { value: '96%', label: 'Collected on the night' }).
export const PROOF_STATS: { value: string; label: string }[] = []
export const TESTIMONIAL: { quote: string; name: string; area: string } | null = null

export interface CoverageZone {
  name: string
  city: string
  lat: number
  lng: number
  radiusKm: number
  outline: [number, number][] | null // the drawn outline, [lng, lat] points
}

// Zones Trashit collects in today, straight from the ops Zones screen.
export async function activeZones(): Promise<CoverageZone[]> {
  try {
    const zones = await prisma.zone.findMany({
      where: { active: true, centerLat: { not: null }, centerLng: { not: null } },
      select: { name: true, city: true, centerLat: true, centerLng: true, radiusKm: true, boundary: true },
      orderBy: { name: 'asc' },
    })
    return zones.map((z) => ({ name: z.name, city: z.city, lat: z.centerLat!, lng: z.centerLng!, radiusKm: z.radiusKm, outline: storedBoundary(z.boundary)?.coordinates[0] ?? null }))
  } catch (e) {
    console.error('[marketing] could not load zones', e)
    return []
  }
}

// A circle as a polygon ring (lng, lat pairs), for drawing a zone on the static map.
function circleRing(lat: number, lng: number, km: number, points = 40): [number, number][] {
  const ring: [number, number][] = []
  const dLat = km / 110.574
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * 2 * Math.PI
    ring.push([+(lng + dLng * Math.cos(a)).toFixed(5), +(lat + dLat * Math.sin(a)).toFixed(5)])
  }
  return ring
}

// Keeps every n-th corner so a long outline fits in a map address; the ring stays closed.
function thin(ring: [number, number][], max: number): [number, number][] {
  if (ring.length <= max) return ring
  const step = Math.ceil((ring.length - 1) / (max - 1))
  const out = ring.filter((_, i) => i % step === 0).map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)] as [number, number])
  out.push(out[0])
  return out
}

// A Mapbox static map of the live zones (night style), or null without a token or zones.
export function coverageMapUrl(zones: CoverageZone[], width = 640, height = 440): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token || zones.length === 0) return null
  const shown = zones.slice(0, 12)
  const geojson = {
    type: 'FeatureCollection',
    features: shown.map((z) => ({
      type: 'Feature',
      properties: { fill: '#12825a', 'fill-opacity': 0.28, stroke: '#3fd99a', 'stroke-width': 2, 'stroke-opacity': 0.9 },
      // The drawn outline, simplified to at most 40 points so the map address stays short.
      geometry: { type: 'Polygon', coordinates: [z.outline ? thin(z.outline, 40) : circleRing(z.lat, z.lng, z.radiusKm)] },
    })),
  }
  const pins = shown.map((z) => `pin-s+3fd99a(${z.lng.toFixed(5)},${z.lat.toFixed(5)})`).join(',')
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(geojson))}),${pins}`
  const position = shown.length === 1 ? `${shown[0].lng.toFixed(4)},${shown[0].lat.toFixed(4)},11.2` : 'auto'
  const padding = shown.length === 1 ? '' : '&padding=48'
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/${position}/${width}x${height}@2x?access_token=${token}${padding}&attribution=false&logo=false`
}
