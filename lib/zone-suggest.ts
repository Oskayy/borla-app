// "Suggest zones": proposes zone outlines and tiers for an area. Pure functions (no network, no database), so they
// can be unit-tested; lib/zone-suggest-server.ts fetches the data. Nothing here is saved: each suggestion is shown
// to a person, who reviews it and saves it like any drawn zone.
//
// 1. Cells: one per named neighbourhood (OpenStreetMap place points), split between neighbours (Voronoi), trimmed to
//    the area and cut away from existing zones. Without enough named places, a grid of the chosen size.
// 2. Tier: from what can be measured. Many homes with a swimming pool and large, spread-out plots lean premium;
//    small, closely packed buildings without pools lean basic; where Trashit has orders, their average value nudges it.
//    Scores are compared within the area, so the tiers are relative, and every suggestion lists its reasons.

import voronoi from '@turf/voronoi'
import bbox from '@turf/bbox'
import intersect from '@turf/intersect'
import difference from '@turf/difference'
import area from '@turf/area'
import { featureCollection, point, polygon as turfPolygon } from '@turf/helpers'
import { containsPoint, isShapeError, parseBoundary, type Position, type ZoneBoundary } from './zone-shape'
import type { ZoneTier } from '@prisma/client'

export interface Place {
  name: string
  lat: number
  lng: number
}

export interface Cell {
  name: string
  boundary: ZoneBoundary
  km2: number
}

export interface CellStats {
  buildings: number | null // null: OpenStreetMap didn't answer
  pools: number | null
  orders: number
  avgOrderGhs: number | null
}

export interface Suggestion extends Cell {
  tier: ZoneTier
  reasons: string[]
  stats: CellStats & { buildingsPerKm2: number | null }
}

export const MAX_SCAN_KM2 = 150
export const MIN_CELL_KM2 = 0.3

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>

// The largest single piece of a (multi)polygon, as a checked outline; null if nothing usable is left.
function largestPiece(f: Poly | null): ZoneBoundary | null {
  if (!f) return null
  const g = f.geometry
  const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0])
  let best: Position[] | null = null
  let bestArea = 0
  for (const r of rings) {
    const a = area(turfPolygon([r])) / 1e6
    if (a > bestArea) [best, bestArea] = [r as Position[], a]
  }
  if (!best) return null
  const out = parseBoundary({ type: 'Polygon', coordinates: [best] })
  return isShapeError(out) ? null : out
}

// Cuts the area out of every existing zone, so suggestions never overlap what is already there.
function clip(cell: Poly, scan: ZoneBoundary, existing: ZoneBoundary[]): Poly | null {
  let f: Poly | null = intersect(featureCollection([cell, turfPolygon(scan.coordinates)]))
  for (const z of existing) {
    if (!f) return null
    f = difference(featureCollection([f, turfPolygon(z.coordinates)]))
  }
  return f
}

function gridCells(scan: ZoneBoundary, existing: ZoneBoundary[], targetKm2: number): Cell[] {
  const [w, s, e, n] = bbox(turfPolygon(scan.coordinates))
  const midLat = (s + n) / 2
  const side = Math.sqrt(targetKm2)
  const dLat = side / 111.195
  const dLng = side / (111.195 * Math.cos((midLat * Math.PI) / 180))
  const out: Cell[] = []
  let k = 1
  for (let lat = s; lat < n; lat += dLat) {
    for (let lng = w; lng < e; lng += dLng) {
      const sq = turfPolygon([[[lng, lat], [lng + dLng, lat], [lng + dLng, lat + dLat], [lng, lat + dLat], [lng, lat]]])
      const b = largestPiece(clip(sq, scan, existing))
      if (b) {
        const km2 = area(turfPolygon(b.coordinates)) / 1e6
        if (km2 >= MIN_CELL_KM2) out.push({ name: `Area ${k++}`, boundary: b, km2 })
      }
    }
  }
  return out
}

// Cells for an area: one per neighbourhood, or a grid when there are fewer than two named places.
export function buildCells(scan: ZoneBoundary, places: Place[], existing: ZoneBoundary[], targetKm2: number): Cell[] {
  const inside = dedupe(places.filter((p) => containsPoint(scan, p.lat, p.lng)))
  if (inside.length < 2) return gridCells(scan, existing, targetKm2)
  const box = bbox(turfPolygon(scan.coordinates))
  const v = voronoi(featureCollection(inside.map((p) => point([p.lng, p.lat]))), { bbox: box })
  const out: Cell[] = []
  v.features.forEach((f, i) => {
    if (!f) return
    const b = largestPiece(clip(f as Poly, scan, existing))
    if (!b) return
    const km2 = area(turfPolygon(b.coordinates)) / 1e6
    if (km2 >= MIN_CELL_KM2) out.push({ name: inside[i].name, boundary: b, km2: Math.round(km2 * 100) / 100 })
  })
  return out
}

// One point per name (OpenStreetMap sometimes has the same neighbourhood twice).
function dedupe(places: Place[]): Place[] {
  const seen = new Map<string, Place>()
  for (const p of places) {
    const key = p.name.trim().toLowerCase()
    if (key && !seen.has(key)) seen.set(key, { ...p, name: p.name.trim().slice(0, 80) })
  }
  return [...seen.values()]
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2))) || 1
const z = (x: number, xs: number[]) => (x - mean(xs)) / sd(xs)

// Tiers for a set of cells, compared with each other. Top third of the score premium, bottom third basic.
// Tuned on Accra (Airport Residential, Cantonments and East Legon premium; Nima, Maamobi and Kotobabi basic): the
// share of buildings with a pool says most; fewer buildings per km² adds a little. Below 150 per km² density counts
// for nothing: that is more often open land or gaps in the map than large plots.
const SPARSE = 150
export function scoreCells(cells: (Cell & { stats: CellStats })[]): Suggestion[] {
  const density = cells.map((c) => (c.stats.buildings != null ? c.stats.buildings / c.km2 : null))
  const poolShare = cells.map((c) => (c.stats.buildings != null && c.stats.pools != null ? (1000 * c.stats.pools) / Math.max(c.stats.buildings, 50) : null))
  const known = <T>(xs: (T | null)[]) => xs.filter((x): x is T => x != null)
  const logDensity = known(density).filter((d) => d >= SPARSE).map((d) => Math.log(d + 1))
  const logShare = known(poolShare).map((p) => Math.log(p + 0.5))
  const valued = cells.filter((c) => c.stats.orders >= 5 && c.stats.avgOrderGhs != null).map((c) => c.stats.avgOrderGhs!)

  const scored = cells.map((c, i) => {
    let score = 0
    const reasons: string[] = []
    const d = density[i]
    if (d != null) {
      const zd = d >= SPARSE && logDensity.length > 1 ? z(Math.log(d + 1), logDensity) : 0
      score -= 0.4 * zd
      reasons.push(`${Math.round(d).toLocaleString('en-GB')} buildings per km²${d < SPARSE ? ': few mapped, so open land or gaps in the map; check by eye' : zd < -0.5 ? ', spread out' : zd > 0.5 ? ', closely packed' : ''}`)
    }
    const share = poolShare[i]
    if (share != null && logShare.length > 1) {
      score += z(Math.log(share + 0.5), logShare)
      reasons.push(c.stats.pools ? `${c.stats.pools} swimming ${c.stats.pools === 1 ? 'pool' : 'pools'} (${share.toFixed(1)} per 1,000 buildings)` : 'No swimming pools mapped')
    }
    if (c.stats.orders >= 5 && c.stats.avgOrderGhs != null && valued.length > 1) {
      score += 0.5 * z(c.stats.avgOrderGhs, valued)
      reasons.push(`${c.stats.orders} orders, average GHS ${c.stats.avgOrderGhs.toFixed(2)}`)
    } else if (c.stats.orders > 0) {
      reasons.push(`${c.stats.orders} ${c.stats.orders === 1 ? 'order' : 'orders'} so far`)
    }
    if (c.stats.buildings == null) reasons.push('OpenStreetMap didn’t answer for buildings: check this one by eye')
    return { c, i, score, reasons, d }
  })

  const order = [...scored].sort((a, b) => b.score - a.score)
  const third = Math.max(1, Math.floor(scored.length / 3))
  const measured = scored.some((s) => s.d != null)
  return scored.map((s) => {
    const rank = order.indexOf(s)
    const tier: ZoneTier = !measured || scored.length < 3 ? 'STANDARD' : rank < third ? 'PREMIUM' : rank >= scored.length - third ? 'BASIC' : 'STANDARD'
    return { ...s.c, tier, reasons: s.reasons, stats: { ...s.c.stats, buildingsPerKm2: s.d != null ? Math.round(s.d) : null } }
  })
}

// Building and pool counts come from OpenStreetMap per square of about 1 km (box filters are quick there; outline
// filters were far too slow), then each cell takes its share of every square from 3 x 3 sample points per square.
export interface Tile {
  box: [number, number, number, number] // south, west, north, east
  samples: [number, number][] // [lat, lng] points inside the scanned area
}

const TILE_DEG = 0.009 // about 1 km
const MAX_TILES = 200

export function scanTiles(scan: ZoneBoundary): Tile[] {
  const [w, s, e, n] = bbox(turfPolygon(scan.coordinates))
  const make = (deg: number) => {
    const out: Tile[] = []
    for (let lat = s; lat < n - 1e-9; lat += deg) {
      for (let lng = w; lng < e - 1e-9; lng += deg) {
        const samples: [number, number][] = []
        for (const a of [1, 3, 5]) for (const b of [1, 3, 5]) {
          const p: [number, number] = [lat + (deg * a) / 6, lng + (deg * b) / 6]
          if (containsPoint(scan, p[0], p[1])) samples.push(p)
        }
        if (samples.length) out.push({ box: [lat, lng, lat + deg, lng + deg], samples })
      }
    }
    return out
  }
  let tiles = make(TILE_DEG)
  if (tiles.length > MAX_TILES) tiles = make(TILE_DEG * Math.sqrt(tiles.length / (MAX_TILES * 0.9)))
  return tiles
}

// One Overpass query for everything: named places in the area, then a building count and a pool count per square.
// Built from numbers only, so nothing typed by a person ever reaches it.
export function overpassQuery(scan: ZoneBoundary, tiles: Tile[]): string {
  const [w, s, e, n] = bbox(turfPolygon(scan.coordinates)).map((x) => x.toFixed(6))
  const boxes = tiles.map((t) => t.box.map((x) => x.toFixed(6)).join(','))
  return (
    `[out:json][timeout:90];node["place"~"^(suburb|neighbourhood|quarter)$"]["name"](${s},${w},${n},${e});out 200;` +
    boxes.map((b) => `way["building"](${b});out count;nwr["leisure"="swimming_pool"](${b});out count;`).join('')
  )
}

// Each cell's estimated building and pool counts: every square shares its counts among its sample points.
export function cellCounts(cells: Cell[], tiles: Tile[], counts: { buildings: number; pools: number }[] | null): { buildings: number | null; pools: number | null }[] {
  if (!counts || counts.length !== tiles.length) return cells.map(() => ({ buildings: null, pools: null }))
  return cells.map((c) => {
    let buildings = 0
    let pools = 0
    let hits = 0
    tiles.forEach((t, i) => {
      for (const [lat, lng] of t.samples) {
        if (!containsPoint(c.boundary, lat, lng)) continue
        hits++
        buildings += counts[i].buildings / 9
        pools += counts[i].pools / 9
      }
    })
    return hits ? { buildings: Math.round(buildings), pools: Math.round(pools) } : { buildings: null, pools: null }
  })
}
