// Place search for the home pin ("type your area, street or a place near you"): suggestions with coordinates, in
// Ghana only, nearest first. OpenStreetMap (through Photon, a free search-as-you-type service) knows Ghana's
// landmarks (schools, banks, hospitals, malls, flats), which is how most people here describe where they live;
// Mapbox (areas and streets only in Ghana) answers when Photon doesn't. Server-side only: answers are cached for a
// day in memory, and the route that calls this is signed-in and rate-limited, so Photon's fair-use policy holds.

export interface PlaceHit {
  id: string
  name: string // e.g. "Tema General Hospital"
  detail: string // e.g. "Hospital Road, Obenyade, Tema"
  lat: number
  lng: number
}

const DAY = 86_400_000
const TIMEOUT_MS = 9000
const UA = 'Trashit (home pin search, Ghana)'
const cache = new Map<string, { at: number; hits: PlaceHit[] }>()

// Ghana's bounding box, with a little room; anything outside is dropped.
const inGhana = (lat: number, lng: number) => lat >= 4.5 && lat <= 11.4 && lng >= -3.5 && lng <= 1.4
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: { osm_type?: string; osm_id?: number; name?: string; street?: string; housenumber?: string; district?: string; locality?: string; city?: string; county?: string; state?: string }
}

async function photon(q: string, near: { lat: number; lng: number }): Promise<PlaceHit[] | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${near.lat.toFixed(3)}&lon=${near.lng.toFixed(3)}&limit=8&lang=en&bbox=-3.5,4.5,1.4,11.4`
  const data = (await getJson(url, { 'User-Agent': UA })) as { features?: PhotonFeature[] } | null
  if (!data) return null
  const out: PlaceHit[] = []
  for (const f of data.features ?? []) {
    const p = f.properties ?? {}
    const [lng, lat] = f.geometry?.coordinates ?? []
    if (!ok(lat) || !ok(lng) || !inGhana(lat, lng)) continue
    const name = clip(p.name ?? (p.street ? `${p.housenumber ? p.housenumber + ' ' : ''}${p.street}` : ''), 120)
    if (!name) continue
    const parts = [p.street !== p.name ? p.street : null, p.district ?? p.locality, p.city ?? p.county ?? p.state].filter((x): x is string => !!x && x !== name)
    // 'La-Dade-Kotopon Municipal District' reads as 'La-Dade-Kotopon': shorter on a phone, still clear.
    const short = parts.map((x) => x.replace(/\s+(Municipal|Metropolitan)(\s+District)?$|\s+District$/i, ''))
    out.push({ id: clip(`osm:${p.osm_type ?? ''}${p.osm_id ?? `${lat},${lng}`}`, 200), name, detail: clip([...new Set(short)].join(', '), 160), lat, lng })
  }
  return out
}

type MapboxFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: { mapbox_id?: string; name?: string; full_address?: string; place_formatted?: string; coordinates?: { latitude?: number; longitude?: number } }
}

async function mapbox(q: string, near: { lat: number; lng: number }): Promise<PlaceHit[] | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return null
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=gh&limit=6&language=en&autocomplete=true&proximity=${near.lng.toFixed(3)},${near.lat.toFixed(3)}&access_token=${token}`
  const data = (await getJson(url)) as { features?: MapboxFeature[] } | null
  if (!data) return null
  const out: PlaceHit[] = []
  for (const f of data.features ?? []) {
    const p = f.properties ?? {}
    const lng = p.coordinates?.longitude ?? f.geometry?.coordinates?.[0]
    const lat = p.coordinates?.latitude ?? f.geometry?.coordinates?.[1]
    if (!ok(lat) || !ok(lng) || !inGhana(lat, lng)) continue
    const name = clip(p.name, 120)
    if (!name) continue
    out.push({ id: clip(p.mapbox_id ?? `${lat},${lng}`, 200), name, detail: clip((p.place_formatted ?? '').replace(/,?\s*Ghana$/i, ''), 160), lat, lng })
  }
  return out
}

// `near`: where the person is likely to be (their pin), so nearer places come first; Accra otherwise.
// Null only when neither service answered.
export async function searchPlaces(query: string, near?: { lat: number; lng: number } | null): Promise<PlaceHit[] | null> {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, 120)
  if (q.length < 3) return []
  const at = near && inGhana(near.lat, near.lng) ? near : { lat: 5.604, lng: -0.187 }
  const key = `${q.toLowerCase()}|${at.lat.toFixed(2)},${at.lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < DAY) return hit.hits

  let hits = await photon(q, at)
  if (!hits || hits.length === 0) {
    const more = await mapbox(q, at)
    if (hits === null && more === null) return null
    hits = more ?? hits ?? []
  }
  // The same place often comes back several times (a mall, its car park, its bus stop): keep one per name and area.
  const seen = new Set<string>()
  hits = hits
    .filter((h) => {
      const k = `${h.name.toLowerCase()}|${h.lat.toFixed(2)},${h.lng.toFixed(2)}`
      return seen.has(k) ? false : (seen.add(k), true)
    })
    .slice(0, 6)
  if (cache.size > 2000) cache.clear()
  cache.set(key, { at: Date.now(), hits })
  return hits
}
