// Zone outlines: checking a drawn outline, matching an address to a zone, overlaps and the circle conversion.
import { describe, expect, it } from 'vitest'
import { areaKm2, circleToBoundary, containsPoint, isShapeError, overlapKm2, parseBoundary, type Position, type ZoneBoundary } from '@/lib/zone-shape'
import { pickZone } from '@/lib/zone-match'
import { distanceInMeters } from '@/lib/geo'

// A square about 2.2 km a side in Tema.
const sq = (lng: number, lat: number, d = 0.02): Position[] => [
  [lng, lat],
  [lng + d, lat],
  [lng + d, lat + d],
  [lng, lat + d],
  [lng, lat],
]
const shape = (ring: Position[]): ZoneBoundary => ({ type: 'Polygon', coordinates: [ring] })
const ok = (input: unknown) => {
  const r = parseBoundary(input)
  if (isShapeError(r)) throw new Error(r.error)
  return r
}

describe('parseBoundary', () => {
  it('accepts a closed outline and closes an open one', () => {
    expect(ok(shape(sq(-0.02, 5.66))).coordinates[0]).toHaveLength(5)
    const open = sq(-0.02, 5.66).slice(0, 4)
    const closed = ok({ type: 'Polygon', coordinates: [open] }).coordinates[0]
    expect(closed[0]).toEqual(closed[closed.length - 1])
  })
  it('drops repeated clicks on the same spot', () => {
    const r = sq(-0.02, 5.66)
    expect(ok(shape([r[0], r[0], r[1], r[2], r[2], r[3], r[4]])).coordinates[0]).toHaveLength(5)
  })
  it('refuses shapes that cannot be a zone', () => {
    const bad: unknown[] = [
      null,
      { type: 'Polygon', coordinates: [] },
      { type: 'MultiPolygon', coordinates: [[sq(-0.02, 5.66)]] },
      shape([[-0.02, 5.66], [-0.01, 5.66], [-0.02, 5.66]]), // two corners
      shape([[-0.02, 5.66], [NaN, 5.67], [-0.01, 5.67], [-0.02, 5.66]]),
      shape(sq(10, 5.66)), // not in Ghana
      shape(sq(-0.02, 5.66, 0.0005)), // tiny
      shape(sq(-1.5, 6, 0.6)), // huge
      shape([[-0.02, 5.66], [0, 5.68], [0, 5.66], [-0.02, 5.68], [-0.02, 5.66]]), // a bow tie: lines cross
      shape(Array.from({ length: 600 }, (_, i) => [-0.02 + 0.02 * Math.cos(i / 95), 5.66 + 0.02 * Math.sin(i / 95)] as Position)),
    ]
    for (const b of bad) expect(isShapeError(parseBoundary(b)), JSON.stringify(b)?.slice(0, 60)).toBe(true)
  })
})

describe('containsPoint and overlaps', () => {
  const a = shape(sq(-0.02, 5.66))
  it('knows inside, outside and the edge', () => {
    expect(containsPoint(a, 5.67, -0.01)).toBe(true)
    expect(containsPoint(a, 5.70, -0.01)).toBe(false)
    expect(containsPoint(a, 5.66, -0.01)).toBe(true) // on the edge counts as inside
  })
  it('treats a shared border as no overlap, and a real overlap as one', () => {
    const neighbour = shape(sq(0, 5.66)) // shares the east edge
    expect(overlapKm2(a, neighbour)).toBeLessThan(0.001)
    const over = shape(sq(-0.01, 5.66))
    expect(overlapKm2(a, over)).toBeGreaterThan(1)
  })
})

describe('pickZone with outlines', () => {
  const zone = (id: string, ring: Position[] | null, extra: Partial<{ centerLat: number; centerLng: number; radiusKm: number }> = {}) => ({
    id,
    name: id,
    city: 'Tema',
    centerLat: extra.centerLat ?? null,
    centerLng: extra.centerLng ?? null,
    radiusKm: extra.radiusKm ?? 3,
    priceMultiplier: 1,
    boundary: ring ? shape(ring) : null,
  })
  it('uses the outline, not the old circle', () => {
    const z = zone('outline', sq(-0.02, 5.66), { centerLat: 5.67, centerLng: -0.01, radiusKm: 50 })
    expect(pickZone([z], 5.67, -0.01)?.id).toBe('outline')
    expect(pickZone([z], 5.8, -0.01)).toBeNull() // inside the big circle, outside the outline
  })
  it('prefers the smaller zone if outlines ever overlap', () => {
    const big = zone('big', sq(-0.03, 5.65, 0.05))
    const small = zone('small', sq(-0.02, 5.66))
    expect(pickZone([big, small], 5.67, -0.01)?.id).toBe('small')
  })
  it('still matches a zone that has only a circle', () => {
    const c = zone('circle', null, { centerLat: 5.67, centerLng: -0.01, radiusKm: 2 })
    expect(pickZone([c], 5.675, -0.01)?.id).toBe('circle')
    expect(pickZone([c], 5.75, -0.01)).toBeNull()
  })
})

describe('circleToBoundary', () => {
  it('is a valid outline that contains the whole circle', () => {
    const [lat, lng, r] = [5.6698, -0.0166, 3]
    const b = circleToBoundary(lat, lng, r)
    expect(isShapeError(parseBoundary(b))).toBe(false)
    // Points on the old circle's edge (by true distance, as the old matching measured it), all the way round, are
    // inside the outline.
    for (let i = 0; i < 360; i += 5) {
      const a = (i * Math.PI) / 180
      const at = (k: number) => [lat + ((r * k) / 110.574) * Math.sin(a), lng + ((r * k) / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)]
      let k = 1
      for (let step = 0; step < 30; step++) {
        const [pLat, pLng] = at(k)
        k *= r / (distanceInMeters(lat, lng, pLat, pLng) / 1000)
      }
      const [pLat, pLng] = at(k)
      expect(Math.abs(distanceInMeters(lat, lng, pLat, pLng) / 1000 - r)).toBeLessThan(1e-6)
      expect(containsPoint(b, pLat, pLng)).toBe(true)
    }
    // And the outline is barely bigger than the circle (within 1%).
    expect(areaKm2(b) / (Math.PI * r * r)).toBeLessThan(1.01)
  })
})

describe('parseZoneBody', async () => {
  const { parseZoneBody, ZONE_EDIT_ROLES } = await import('@/lib/zones')
  const base = { name: 'East Legon', city: 'Accra', coveredAreas: 'East Legon, Adjiringanor' }
  it('turns the older centre and radius into an outline, with the centre worked out from it', () => {
    const r = parseZoneBody({ ...base, centerLat: 5.635, centerLng: -0.155, radiusKm: 2 })
    if ('error' in r) throw new Error(r.error)
    expect(r.boundary.coordinates[0]).toHaveLength(33)
    expect(r.centerLat).toBeCloseTo(5.635, 4)
    expect(r.coveredAreas).toEqual(['East Legon', 'Adjiringanor'])
  })
  it('takes a drawn outline, and ignores any centre sent with it', () => {
    const r = parseZoneBody({ ...base, centerLat: 9, centerLng: 0, boundary: shape(sq(-0.17, 5.62)), tier: 'PREMIUM' })
    if ('error' in r) throw new Error(r.error)
    expect(r.centerLat).toBeCloseTo(5.63, 2)
    expect(r.tier).toBe('PREMIUM')
  })
  it('refuses bad input with a reason', () => {
    for (const b of [
      { ...base, name: '' },
      { ...base, centerLat: 5.6, centerLng: -0.1, radiusKm: 40 },
      { ...base },
      { ...base, boundary: shape(sq(10, 5.66)) },
      { ...base, boundary: shape(sq(-0.17, 5.62)), tier: 'GOLD' },
    ]) {
      const r = parseZoneBody(b)
      expect('error' in r, JSON.stringify(b).slice(0, 80)).toBe(true)
    }
  })
  it('lets only Ops Managers and Super Admins change zones', () => {
    expect(ZONE_EDIT_ROLES).toEqual(['SUPER_ADMIN', 'OPS_MANAGER'])
  })
})

describe('trimToFit', async () => {
  const { trimToFit } = await import('@/lib/zone-shape')
  it('cuts the overlap away so the result only touches the neighbour', () => {
    const neighbour = shape(sq(-0.02, 5.66))
    const drawn = shape(sq(-0.01, 5.66)) // half on top of the neighbour
    const t = trimToFit(drawn, [neighbour])
    expect(t).not.toBeNull()
    expect(overlapKm2(t!, neighbour)).toBeLessThan(0.001)
    expect(areaKm2(t!)).toBeGreaterThan(areaKm2(drawn) * 0.4)
  })
  it('gives nothing back when the outline is wholly inside another zone', () => {
    expect(trimToFit(shape(sq(-0.015, 5.665, 0.005)), [shape(sq(-0.02, 5.66))])).toBeNull()
  })
})
