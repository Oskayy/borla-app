import { prisma } from '@/lib/prisma'

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
}

// Zones Trashit collects in today, straight from the ops Zones screen.
export async function activeZones(): Promise<CoverageZone[]> {
  try {
    const zones = await prisma.zone.findMany({
      where: { active: true, centerLat: { not: null }, centerLng: { not: null } },
      select: { name: true, city: true, centerLat: true, centerLng: true, radiusKm: true },
      orderBy: { name: 'asc' },
    })
    return zones.map((z) => ({ name: z.name, city: z.city, lat: z.centerLat!, lng: z.centerLng!, radiusKm: z.radiusKm }))
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
      geometry: { type: 'Polygon', coordinates: [circleRing(z.lat, z.lng, z.radiusKm)] },
    })),
  }
  const pins = shown.map((z) => `pin-s+3fd99a(${z.lng.toFixed(5)},${z.lat.toFixed(5)})`).join(',')
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(geojson))}),${pins}`
  const position = shown.length === 1 ? `${shown[0].lng.toFixed(4)},${shown[0].lat.toFixed(4)},11.2` : 'auto'
  const padding = shown.length === 1 ? '' : '&padding=48'
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/${position}/${width}x${height}@2x?access_token=${token}${padding}&attribution=false&logo=false`
}
