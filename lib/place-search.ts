// Server-side place search for the home pin, the fallback when the phone can't reach OpenStreetMap's Photon itself
// (components/PlaceSearch.tsx asks it directly, which is faster). Suggestions with coordinates, in
// Ghana only, nearest first. OpenStreetMap (through Photon, a free search-as-you-type service) knows Ghana's
// landmarks (schools, banks, hospitals, malls, flats), which is how most people here describe where they live;
// Mapbox (areas and streets only in Ghana) answers when Photon doesn't. Server-side only: answers are cached for a
// day in memory, and the route that calls this is signed-in and rate-limited, so Photon's fair-use policy holds.

import { dedupePlaces, inGhana, parsePhoton, photonUrl, type PlaceHit } from './place-parse'

export type { PlaceHit }

const DAY = 86_400_000
const TIMEOUT_MS = 9000
const UA = 'Trashit (home pin search, Ghana)'
const cache = new Map<string, { at: number; hits: PlaceHit[] }>()

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

async function photon(q: string, near: { lat: number; lng: number }): Promise<PlaceHit[] | null> {
  const data = await getJson(photonUrl(q, near), { 'User-Agent': UA })
  return data ? parsePhoton(data) : null
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
  hits = dedupePlaces(hits)
  if (cache.size > 2000) cache.clear()
  cache.set(key, { at: Date.now(), hits })
  return hits
}
