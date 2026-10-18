// Zone outlines: a zone is a polygon drawn on the map, stored as GeoJSON ({ type: 'Polygon', coordinates: [ring] },
// each point [lng, lat], the ring closed: first point = last). Pure functions (no database), so they can be
// unit-tested. Matching an address and the overlap check both live here, so the server and the drawing tool agree.

import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import intersect from '@turf/intersect'
import difference from '@turf/difference'
import area from '@turf/area'
import kinks from '@turf/kinks'
import { featureCollection, polygon as turfPolygon } from '@turf/helpers'

export type Position = [number, number] // [lng, lat]
export interface ZoneBoundary {
  type: 'Polygon'
  coordinates: [Position[]] // one outer ring, no holes
}

export const MIN_POINTS = 4 // a closed triangle: 3 corners + the closing point
export const MAX_POINTS = 500
export const MIN_AREA_KM2 = 0.05
export const MAX_AREA_KM2 = 2000
// A shared border is fine; an overlap bigger than this (1,000 m²) is not.
export const OVERLAP_TOLERANCE_KM2 = 0.001
// Ghana, with a little room around it.
const GHANA = { minLat: 4.5, maxLat: 11.4, minLng: -3.5, maxLng: 1.4 }

export type ShapeError = { error: string }

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

// Checks a boundary sent by the browser. Returns a clean, closed outline or the reason it can't be saved.
export function parseBoundary(input: unknown): ZoneBoundary | ShapeError {
  const raw = (input as { coordinates?: unknown } | null)?.coordinates
  const ringIn = Array.isArray(raw) && Array.isArray(raw[0]) && Array.isArray((raw[0] as unknown[])[0]) ? (raw[0] as unknown[]) : raw
  if (!Array.isArray(ringIn)) return { error: 'Draw the zone on the map first' }
  if ((input as { type?: unknown }).type !== undefined && (input as { type?: unknown }).type !== 'Polygon') return { error: 'A zone must be a single outline' }

  const ring: Position[] = []
  for (const p of ringIn) {
    if (!Array.isArray(p) || p.length < 2) return { error: 'The outline has a point that isn’t on the map' }
    const [lng, lat] = p
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      return { error: 'The outline has a point that isn’t on the map' }
    }
    if (lat < GHANA.minLat || lat > GHANA.maxLat || lng < GHANA.minLng || lng > GHANA.maxLng) return { error: 'Every corner of a zone must be in Ghana' }
    const q: Position = [round6(lng), round6(lat)]
    const last = ring[ring.length - 1]
    if (!last || last[0] !== q[0] || last[1] !== q[1]) ring.push(q) // drop repeated clicks
  }
  // Close the ring if the drawing didn't.
  if (ring.length > 0) {
    const [f, l] = [ring[0], ring[ring.length - 1]]
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push([f[0], f[1]])
  }
  if (ring.length < MIN_POINTS) return { error: 'A zone needs at least three corners' }
  if (ring.length > MAX_POINTS) return { error: `A zone can have at most ${MAX_POINTS - 1} corners` }

  const shape: ZoneBoundary = { type: 'Polygon', coordinates: [ring] }
  if (kinks(turfPolygon(shape.coordinates)).features.length > 0) return { error: 'The outline crosses itself. Move a corner so the lines don’t cross.' }
  const km2 = areaKm2(shape)
  if (km2 < MIN_AREA_KM2) return { error: 'This zone is too small to be real (under 0.05 km²)' }
  if (km2 > MAX_AREA_KM2) return { error: `This zone is too large (over ${MAX_AREA_KM2} km²). Split it into smaller zones.` }
  return shape
}

export function isShapeError(x: ZoneBoundary | ShapeError): x is ShapeError {
  return 'error' in x
}

// Reads a boundary stored in the database (already checked when saved); anything odd is treated as no outline.
export function storedBoundary(value: unknown): ZoneBoundary | null {
  const v = value as ZoneBoundary | null
  const ring = v?.type === 'Polygon' && Array.isArray(v.coordinates) ? v.coordinates[0] : null
  return Array.isArray(ring) && ring.length >= MIN_POINTS ? v : null
}

export function areaKm2(shape: ZoneBoundary): number {
  return area(turfPolygon(shape.coordinates)) / 1e6
}

// Inside the outline, or exactly on its edge.
export function containsPoint(shape: ZoneBoundary, lat: number, lng: number): boolean {
  return booleanPointInPolygon([lng, lat], turfPolygon(shape.coordinates))
}

// How much two outlines overlap, in km² (0 when they only touch or don't meet).
export function overlapKm2(a: ZoneBoundary, b: ZoneBoundary): number {
  const hit = intersect(featureCollection([turfPolygon(a.coordinates), turfPolygon(b.coordinates)]))
  return hit ? area(hit) / 1e6 : 0
}

// The middle of an outline (average of its corners), used to centre maps and for a zone's weather tips.
export function centreOf(shape: ZoneBoundary): { lat: number; lng: number } {
  const ring = shape.coordinates[0].slice(0, -1)
  const lng = ring.reduce((n, p) => n + p[0], 0) / ring.length
  const lat = ring.reduce((n, p) => n + p[1], 0) / ring.length
  return { lat: round6(lat), lng: round6(lng) }
}

// Kilometres in one degree of latitude on the same Earth (radius 6,371 km) the old circle check used (lib/geo.ts).
const KM_PER_DEG = (6371 * Math.PI) / 180

// The outline a circle zone becomes: a 32-sided polygon drawn just outside the circle (corners pushed out so the
// flat sides clear it, plus 0.1% to spare), so every address that was in the circle is still in the zone. Same
// formula as the database migration (20261018120000_zone_outlines).
export function circleToBoundary(lat: number, lng: number, radiusKm: number, sides = 32): ZoneBoundary {
  const r = (radiusKm / Math.cos(Math.PI / sides)) * 1.001
  const ring: Position[] = []
  for (let i = 0; i <= sides; i++) {
    const a = (2 * Math.PI * i) / sides
    ring.push([round6(lng + (r / (KM_PER_DEG * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)), round6(lat + (r / KM_PER_DEG) * Math.sin(a))])
  }
  ring[sides] = [ring[0][0], ring[0][1]]
  return { type: 'Polygon', coordinates: [ring] }
}

// "Trim to fit": cuts the parts of an outline that overlap other zones. If the cut leaves several pieces, the largest
// is kept. Returns null when nothing sensible is left. The server checks the result again before saving.
export function trimToFit(shape: ZoneBoundary, others: ZoneBoundary[]): ZoneBoundary | null {
  let current: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null = turfPolygon(shape.coordinates)
  for (const o of others) {
    if (!current) return null
    if (overlapKm2(shape, o) <= OVERLAP_TOLERANCE_KM2) continue
    current = difference(featureCollection([current, turfPolygon(o.coordinates)]))
  }
  if (!current) return null
  const g = current.geometry
  const rings: Position[][] = g.type === 'Polygon' ? [g.coordinates[0] as Position[]] : g.coordinates.map((p) => p[0] as Position[])
  let best: Position[] | null = null
  let bestArea = 0
  for (const r of rings) {
    const a = area(turfPolygon([r])) / 1e6
    if (a > bestArea) [best, bestArea] = [r, a]
  }
  if (!best) return null
  const out = parseBoundary({ type: 'Polygon', coordinates: [best] })
  return isShapeError(out) ? null : out
}
