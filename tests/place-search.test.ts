// Home-pin place search: OpenStreetMap (Photon) first, Mapbox when it finds nothing; Ghana only; duplicates merged.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchPlaces } from '@/lib/place-search'

const photonFeature = (name: string, lng: number, lat: number, extra: Record<string, unknown> = {}) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { osm_type: 'N', osm_id: Math.round(lat * 1e6), name, ...extra },
})

function mockFetch(photon: unknown, mapbox: unknown = { features: [] }) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      const body = url.includes('photon.komoot.io') ? photon : mapbox
      return body === 'fail' ? new Response('', { status: 500 }) : new Response(JSON.stringify(body), { status: 200 })
    })
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('searchPlaces', () => {
  it('returns landmarks from OpenStreetMap, Ghana only, with short area names', async () => {
    mockFetch({
      features: [
        photonFeature('Accra Mall', -0.1717, 5.6223, { street: 'Spintex Road', county: 'La-Dade-Kotopon Municipal District' }),
        photonFeature('Accra Mall', -0.1714, 5.6226, { street: 'Spintex Road' }), // its car park, a few metres away
        photonFeature('Accra Mall', 3.4, 6.45), // Lagos: outside Ghana
      ],
    })
    const hits = await searchPlaces('Accra Mall test-1')
    expect(hits).toEqual([{ id: expect.any(String), name: 'Accra Mall', detail: 'Spintex Road, La-Dade-Kotopon', lat: 5.6223, lng: -0.1717 }])
  })

  it('asks Mapbox when OpenStreetMap finds nothing', async () => {
    const calls = mockFetch(
      { features: [] },
      { features: [{ geometry: { coordinates: [-0.0047, 5.6705] }, properties: { mapbox_id: 'm1', name: 'Community 4', place_formatted: 'Tema, Greater Accra, Ghana' } }] }
    )
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test')
    const hits = await searchPlaces('Community 4 test-2')
    expect(hits?.map((h) => `${h.name} | ${h.detail}`)).toEqual(['Community 4 | Tema, Greater Accra'])
    expect(calls.some((u) => u.includes('api.mapbox.com'))).toBe(true)
    vi.unstubAllEnvs()
  })

  it('is null only when neither service answers, and empty for under 3 letters', async () => {
    mockFetch('fail', 'fail')
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test')
    expect(await searchPlaces('Kotobabi test-3')).toBeNull()
    expect(await searchPlaces('ab')).toEqual([])
    vi.unstubAllEnvs()
  })

  it('sends the typed text encoded, never as raw URL parts', async () => {
    const calls = mockFetch({ features: [] })
    await searchPlaces('a&b=c test-4')
    expect(calls[0]).toContain('q=a%26b%3Dc%20test-4')
  })
})

describe('matchLocal (the built-in neighbourhood list)', async () => {
  const { readFileSync } = await import('node:fs')
  const path = await import('node:path')
  const { matchLocal, normalisePlace } = await import('@/lib/place-parse')
  const list = JSON.parse(readFileSync(path.resolve(__dirname, '../public/places/gh-places.json'), 'utf8')).places

  it('finds areas from two letters, best match first', () => {
    expect(matchLocal(list, 'kotob')[0].name).toBe('Kotobabi')
    expect(matchLocal(list, 'east le')[0].name).toBe('East Legon')
    expect(matchLocal(list, 'ko').length).toBeGreaterThan(0)
    expect(matchLocal(list, 'k')).toEqual([])
  })

  it('understands short forms', () => {
    expect(normalisePlace('Comm. 4')).toBe('community 4')
    expect(matchLocal(list, 'comm 4')[0].name).toBe('Community 4')
  })

  it('puts nearer places first when it knows roughly where you are', () => {
    const nearTema = matchLocal(list, 'community 1', { lat: 5.67, lng: -0.01 })
    expect(nearTema[0].detail).toBe('Tema, Greater Accra')
  })

  it('covers every region and stays small enough to load on a phone', () => {
    const regions = new Set(list.map((p: [string, number, number, string]) => p[3].split(', ').pop()))
    expect(regions.size).toBe(16)
    expect(readFileSync(path.resolve(__dirname, '../public/places/gh-places.json')).length).toBeLessThan(450_000)
    expect(matchLocal(list, 'bolga')[0].detail).toBe('Upper East')
    expect(matchLocal(list, 'asokwa')[0].detail).toBe('Kumasi, Ashanti')
  })

  it('matches fast enough to run on every keystroke', () => {
    matchLocal(list, 'warm up')
    const t = performance.now()
    for (const q of ['ko', 'kot', 'koto', 'kotob', 'east l', 'comm 4', 'tamale', 'ho']) matchLocal(list, q)
    expect((performance.now() - t) / 8).toBeLessThan(15)
  })
})
