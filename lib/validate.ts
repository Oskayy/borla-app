const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isValidLat(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLng(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

// Trims text; returns null if empty or longer than max.
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return null
  return trimmed
}

// Reads a JSON body safely: returns null instead of crashing on junk input.
export async function readJson(req: Request): Promise<any | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

// Optional GPS pair: both valid, or both absent.
export function parseGps(
  body: any
): { ok: true; lat: number | null; lng: number | null } | { ok: false } {
  const lat = body?.gpsLat ?? null
  const lng = body?.gpsLng ?? null
  if (lat === null && lng === null) return { ok: true, lat: null, lng: null }
  if (isValidLat(lat) && isValidLng(lng)) return { ok: true, lat, lng }
  return { ok: false }
}