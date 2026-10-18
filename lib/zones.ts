import type { ZoneTier } from '@prisma/client'
import { cleanText, isValidLat, isValidLng, type JsonBody } from '@/lib/validate'
import { areaKm2, centreOf, circleToBoundary, isShapeError, parseBoundary, type ZoneBoundary } from '@/lib/zone-shape'

// Who may draw, change or delete zones (a zone decides an address's price). Others with the Zones page can look.
export const ZONE_EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER']
export const ZONE_TIERS: ZoneTier[] = ['PREMIUM', 'STANDARD', 'BASIC']

// Returns the number, null when not provided, or NaN when it is not a number.
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : NaN
}

function parseAreas(value: unknown): string[] | null {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const areas = raw
    .map((a) => (typeof a === 'string' ? a.trim() : ''))
    .filter((a) => a.length > 0)
  if (areas.length > 50 || areas.some((a) => a.length > 60)) return null
  return areas
}

export interface ZoneInput {
  name: string
  city: string
  coveredAreas: string[]
  boundary: ZoneBoundary
  centerLat: number
  centerLng: number
  radiusKm: number
  tier?: ZoneTier
}

// Clean zone data from the browser, or the reason it can't be saved. The outline is either drawn (`boundary`) or,
// from the older form, a centre and radius that become an outline here. The centre is always worked out from the
// outline, so it can't point somewhere else.
export function parseZoneBody(body: JsonBody): ZoneInput | { error: string } {
  const name = cleanText(body?.name, 80)
  const city = cleanText(body?.city, 60)
  const coveredAreas = parseAreas(body?.coveredAreas)
  if (!name || !city) return { error: 'Give the zone a name and a city' }
  if (!coveredAreas) return { error: 'Up to 50 covered areas, each under 60 letters' }

  const tierRaw = body?.tier
  if (tierRaw !== undefined && !ZONE_TIERS.includes(tierRaw as ZoneTier)) return { error: 'Choose premium, standard or basic' }
  const tier = tierRaw as ZoneTier | undefined

  let boundary: ZoneBoundary
  let radiusKm = 3
  if (body?.boundary != null) {
    const shape = parseBoundary(body.boundary)
    if (isShapeError(shape)) return shape
    boundary = shape
    radiusKm = Math.round(Math.sqrt(areaKm2(shape) / Math.PI) * 10) / 10 // a rough size, for older screens only
  } else {
    const lat = optionalNumber(body?.centerLat)
    const lng = optionalNumber(body?.centerLng)
    const r = optionalNumber(body?.radiusKm)
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng) || !isValidLat(lat) || !isValidLng(lng)) {
      return { error: 'Draw the zone on the map, or give its centre' }
    }
    radiusKm = r == null || Number.isNaN(r) ? 3 : r
    if (radiusKm < 0.1 || radiusKm > 25) return { error: 'The radius must be between 0.1 and 25 km' }
    const shape = parseBoundary(circleToBoundary(lat, lng, radiusKm))
    if (isShapeError(shape)) return shape
    boundary = shape
  }
  const centre = centreOf(boundary)
  return { name, city, coveredAreas, boundary, centerLat: centre.lat, centerLng: centre.lng, radiusKm, ...(tier ? { tier } : {}) }
}

