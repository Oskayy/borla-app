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
