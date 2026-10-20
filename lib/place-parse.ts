// Reading place-search answers, shared by the browser (which asks OpenStreetMap's Photon directly, the fastest
// route from a phone in Ghana) and the server (its fallback). Pure: no network here.

export interface PlaceHit {
  id: string
  name: string // e.g. "Tema General Hospital"
  detail: string // e.g. "Hospital Road, Obenyade, Tema"
  lat: number
  lng: number
}

// Ghana's bounding box, with a little room; anything outside is dropped.
export const inGhana = (lat: number, lng: number) => lat >= 4.5 && lat <= 11.4 && lng >= -3.5 && lng <= 1.4
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

// 'La-Dade-Kotopon Municipal District' reads as 'La-Dade-Kotopon': shorter on a phone, still clear.
const shortArea = (x: string) => x.replace(/\s+(Municipal|Metropolitan)(\s+District)?$|\s+District$/i, '')

export function photonUrl(q: string, near: { lat: number; lng: number }): string {
  return `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${near.lat.toFixed(3)}&lon=${near.lng.toFixed(3)}&limit=8&lang=en&bbox=-3.5,4.5,1.4,11.4`
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: { osm_type?: string; osm_id?: number; name?: string; street?: string; housenumber?: string; district?: string; locality?: string; city?: string; county?: string; state?: string }
}

export function parsePhoton(data: unknown): PlaceHit[] {
  const out: PlaceHit[] = []
  for (const f of ((data as { features?: PhotonFeature[] } | null)?.features ?? [])) {
    const p = f.properties ?? {}
    const [lng, lat] = f.geometry?.coordinates ?? []
    if (!ok(lat) || !ok(lng) || !inGhana(lat, lng)) continue
    const name = clip(p.name ?? (p.street ? `${p.housenumber ? p.housenumber + ' ' : ''}${p.street}` : ''), 120)
    if (!name) continue
    const parts = [p.street !== p.name ? p.street : null, p.district ?? p.locality, p.city ?? p.county ?? p.state]
      .filter((x): x is string => !!x && x !== name)
      .map(shortArea)
    out.push({ id: clip(`osm:${p.osm_type ?? ''}${p.osm_id ?? `${lat},${lng}`}`, 200), name, detail: clip([...new Set(parts)].join(', '), 160), lat, lng })
  }
  return out
}

// The same place often comes back several times (a mall, its car park, its bus stop): one per name within ~1 km.
export function dedupePlaces(hits: PlaceHit[], max = 6): PlaceHit[] {
  const seen = new Set<string>()
  return hits
    .filter((h) => {
      const k = `${h.name.toLowerCase()}|${h.lat.toFixed(2)},${h.lng.toFixed(2)}`
      return seen.has(k) ? false : (seen.add(k), true)
    })
    .slice(0, max)
}

// ---- The built-in list of neighbourhoods and towns (public/places/gh-places.json), matched instantly ----

// [name, lat, lng, detail ("nearest town, region"), kind]. All 16 regions, ~7,400 places.
export type LocalPlace = [name: string, lat: number, lng: number, detail: string, kind: number]

// Lower case, no punctuation, and the usual short forms written out ("comm 4" finds "Community 4").
export function normalisePlace(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(comm|com|cmty)\b/g, 'community')
    .replace(/\b(rd)\b/g, 'road')
    .replace(/\b(st)\b/g, 'street')
    .replace(/\b(ext)\b/g, 'extension')
    .replace(/\s+/g, ' ')
    .trim()
}

const km = (a: { lat: number; lng: number }, lat: number, lng: number) => {
  const t = Math.PI / 180
  const x = Math.sin(((lat - a.lat) * t) / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(lat * t) * Math.sin(((lng - a.lng) * t) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(x))
}

// Best matches first: the name starts with what was typed, then a word in it does, then it appears anywhere; towns
// before villages; nearer places first when we know roughly where the person is.
// Each list's names, normalised once (not on every keystroke: the list has thousands of names).
const normalised = new WeakMap<readonly LocalPlace[], string[]>()

export function matchLocal(list: readonly LocalPlace[], query: string, near?: { lat: number; lng: number } | null, max = 5): PlaceHit[] {
  const q = normalisePlace(query)
  if (q.length < 2) return []
  let names = normalised.get(list)
  if (!names) normalised.set(list, (names = list.map((p) => normalisePlace(p[0]))))
  const scored: { p: LocalPlace; s: number }[] = []
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    const n = names[i]
    const at = n.indexOf(q)
    if (at < 0) continue
    let s = at === 0 ? 0 : n.charAt(at - 1) === ' ' ? 10 : 20
    s += p[4] * 1.5 // kind: city 0 … village 4
    if (near) s += Math.min(15, km(near, p[1], p[2]) / 3)
    scored.push({ p, s })
  }
  return scored
    .sort((a, b) => a.s - b.s || a.p[0].length - b.p[0].length)
    .slice(0, max)
    .map(({ p }) => ({ id: `gh:${p[0]}|${p[1]},${p[2]}`, name: p[0], detail: p[3], lat: p[1], lng: p[2] }))
}
