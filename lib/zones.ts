import { cleanText, isValidLat, isValidLng } from '@/lib/validate'

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

// Returns clean zone data, or null if anything is invalid.
export function parseZoneBody(body: any) {
  const name = cleanText(body?.name, 80)
  const city = cleanText(body?.city, 60)
  const coveredAreas = parseAreas(body?.coveredAreas)
  const centerLat = optionalNumber(body?.centerLat)
  const centerLng = optionalNumber(body?.centerLng)
  const radiusRaw = optionalNumber(body?.radiusKm)

  if (!name || !city || !coveredAreas) return null
  if (Number.isNaN(centerLat) || Number.isNaN(centerLng) || Number.isNaN(radiusRaw)) return null
  if (centerLat !== null && !isValidLat(centerLat)) return null
  if (centerLng !== null && !isValidLng(centerLng)) return null
  if ((centerLat === null) !== (centerLng === null)) return null // both or neither

  const radiusKm = radiusRaw === null ? 3 : radiusRaw
  if (radiusKm < 0.1 || radiusKm > 50) return null

  return { name, city, coveredAreas, centerLat, centerLng, radiusKm }
}