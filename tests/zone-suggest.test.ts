// "Suggest zones": cells from neighbourhood points or a grid, never overlapping existing zones, and tiers with reasons.
import { describe, expect, it } from 'vitest'
import { buildCells, cellCounts, overpassQuery, scanTiles, scoreCells, type Cell, type CellStats } from '@/lib/zone-suggest'
import { containsPoint, overlapKm2, parseBoundary, isShapeError, type ZoneBoundary } from '@/lib/zone-shape'

// A box of about 6.7 x 6.7 km (45 km²) in Accra.
const box = (lng: number, lat: number, d: number): ZoneBoundary => {
  const b = parseBoundary({ type: 'Polygon', coordinates: [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]] })
  if (isShapeError(b)) throw new Error(b.error)
  return b
}
const scan = box(-0.2, 5.6, 0.06)

describe('buildCells', () => {
  it('makes one cell per named place, each containing its place', () => {
    const places = [
      { name: 'East', lat: 5.63, lng: -0.15 },
      { name: 'West', lat: 5.63, lng: -0.19 },
      { name: 'North', lat: 5.655, lng: -0.17 },
    ]
    const cells = buildCells(scan, places, [], 5)
    expect(cells.map((c) => c.name).sort()).toEqual(['East', 'North', 'West'])
    for (const c of cells) {
      const p = places.find((x) => x.name === c.name)!
      expect(containsPoint(c.boundary, p.lat, p.lng)).toBe(true)
    }
    // Together they cover the area, without overlapping each other.
    const total = cells.reduce((t, c) => t + c.km2, 0)
    expect(total).toBeGreaterThan(43)
    expect(overlapKm2(cells[0].boundary, cells[1].boundary)).toBeLessThan(0.001)
  })

  it('ignores places outside the area and repeated names', () => {
    const places = [
      { name: 'East', lat: 5.63, lng: -0.15 },
      { name: 'east ', lat: 5.64, lng: -0.15 },
      { name: 'West', lat: 5.63, lng: -0.19 },
      { name: 'Far away', lat: 6.5, lng: -1.5 },
    ]
    expect(buildCells(scan, places, [], 5).map((c) => c.name).sort()).toEqual(['East', 'West'])
  })

  it('falls back to a grid of about the chosen size', () => {
    const cells = buildCells(scan, [], [], 5)
    expect(cells.length).toBeGreaterThanOrEqual(9)
    expect(cells.length).toBeLessThanOrEqual(12)
    for (const c of cells) expect(c.km2).toBeLessThanOrEqual(5.1)
  })

  it('never suggests over an existing zone', () => {
    const existing = box(-0.2, 5.6, 0.03)
    const cells = buildCells(scan, [{ name: 'A', lat: 5.61, lng: -0.19 }, { name: 'B', lat: 5.65, lng: -0.15 }], [existing], 5)
    for (const c of cells) expect(overlapKm2(c.boundary, existing)).toBeLessThan(0.01)
    expect(cells.length).toBeGreaterThan(0)
  })

  it('returns nothing when the area is already covered', () => {
    expect(buildCells(scan, [], [box(-0.21, 5.59, 0.08)], 5)).toEqual([])
  })
})

describe('scoreCells', () => {
  const cell = (name: string, stats: Partial<CellStats>): Cell & { stats: CellStats } => ({
    name,
    km2: 2,
    boundary: scan,
    stats: { buildings: null, pools: null, orders: 0, avgOrderGhs: null, ...stats },
  })

  it('spread-out houses with pools lean premium, packed buildings basic', () => {
    const out = scoreCells([
      cell('Leafy', { buildings: 600, pools: 40 }),
      cell('Middle', { buildings: 2400, pools: 4 }),
      cell('Packed', { buildings: 9000, pools: 0 }),
    ])
    expect(out.map((s) => s.tier)).toEqual(['PREMIUM', 'STANDARD', 'BASIC'])
    expect(out[0].reasons.join(' ')).toMatch(/300 buildings per km², spread out/)
    expect(out[0].reasons.join(' ')).toContain('40 swimming pools (66.7 per 1,000 buildings)')
    expect(out[2].reasons.join(' ')).toMatch(/closely packed/)
    expect(out[2].reasons).toContain('No swimming pools mapped')
    expect(out[0].stats.buildingsPerKm2).toBe(300)
  })

  it('very few buildings is flagged as maybe open land, not rewarded as large plots', () => {
    const out = scoreCells([cell('Bush', { buildings: 40, pools: 0 }), cell('Leafy', { buildings: 600, pools: 0 }), cell('Packed', { buildings: 9000, pools: 0 })])
    expect(out[0].reasons[0]).toMatch(/open land or gaps in the map/)
    expect(out[0].tier).not.toBe('PREMIUM')
  })

  it('order value moves the score where there are enough orders', () => {
    const same = { buildings: 2000, pools: 2 }
    const out = scoreCells([
      cell('A', { ...same, orders: 20, avgOrderGhs: 60 }),
      cell('B', { ...same, orders: 20, avgOrderGhs: 30 }),
      cell('C', { ...same, orders: 20, avgOrderGhs: 45 }),
    ])
    expect(out.map((s) => s.tier)).toEqual(['PREMIUM', 'BASIC', 'STANDARD'])
    expect(out[0].reasons).toContain('20 orders, average GHS 60.00')
  })

  it('everything is Standard when OpenStreetMap gave no counts, or with fewer than three cells', () => {
    expect(scoreCells([cell('A', {}), cell('B', {}), cell('C', {})]).map((s) => s.tier)).toEqual(['STANDARD', 'STANDARD', 'STANDARD'])
    expect(scoreCells([cell('A', { buildings: 100 }), cell('B', { buildings: 9000 })]).map((s) => s.tier)).toEqual(['STANDARD', 'STANDARD'])
    expect(scoreCells([cell('A', {})])[0].reasons.join(' ')).toMatch(/check this one by eye/)
  })
})

describe('squares and the Overpass query', () => {
  it('covers the area in squares of about 1 km, with sample points inside it only', () => {
    const tiles = scanTiles(scan)
    expect(tiles.length).toBe(49) // 0.06° = 6.67 squares a side, so 7 x 7
    for (const t of tiles) for (const [lat, lng] of t.samples) expect(containsPoint(scan, lat, lng)).toBe(true)
  })

  it('uses bigger squares rather than more than 200', () => {
    const big = box(-0.3, 5.55, 0.11) // about 150 km²
    expect(scanTiles(big).length).toBeLessThanOrEqual(200)
  })

  it('is built from numbers only', () => {
    const q = overpassQuery(scan, scanTiles(scan))
    const fixed = ['[out:json][timeout:90];', 'node["place"~"^(suburb|neighbourhood|quarter)$"]["name"]', 'out 200;', 'way["building"]', 'nwr["leisure"="swimming_pool"]', 'out count;']
    let rest = q
    for (const f of fixed) rest = rest.split(f).join('')
    expect(rest).toMatch(/^[-0-9.,();]+$/)
    expect(q.match(/out count;/g)!.length).toBe(98)
  })

  it('shares each square between the cells its sample points fall in', () => {
    const tiles = scanTiles(scan)
    const halves = buildCells(scan, [{ name: 'W', lat: 5.63, lng: -0.185 }, { name: 'E', lat: 5.63, lng: -0.155 }], [], 5)
    const counts = tiles.map(() => ({ buildings: 900, pools: 9 }))
    const est = cellCounts(halves, tiles, counts)
    const total = est.reduce((t, x) => t + (x.buildings ?? 0), 0)
    // Edge squares reach past the area, so only their samples inside it count.
    const inside = tiles.reduce((t, x) => t + x.samples.length, 0) * 100
    expect(Math.abs(total - inside)).toBeLessThan(inside * 0.01)
    expect(cellCounts(halves, tiles, null)).toEqual([{ buildings: null, pools: null }, { buildings: null, pools: null }])
  })
})
