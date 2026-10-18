// Fetches what "Suggest zones" needs: named neighbourhoods and building counts from OpenStreetMap (Overpass, free, no
// key; only this one fixed address is ever called), and Trashit's own orders. One request per scan (it can take a
// minute: the free service is busy); answers are cached for a day in memory so a repeat scan doesn't ask again. Nothing is saved.

import { createHash } from 'node:crypto'
import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildCells, cellCounts, overpassQuery, scanTiles, scoreCells, type Cell, type CellStats, type Place, type Suggestion, type Tile } from '@/lib/zone-suggest'
import { containsPoint, storedBoundary, type ZoneBoundary } from '@/lib/zone-shape'
import bbox from '@turf/bbox'
import { polygon as turfPolygon } from '@turf/helpers'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const HEADERS = { 'User-Agent': 'Trashit ops (zone planning, Ghana)', 'Content-Type': 'application/x-www-form-urlencoded' }
const DAY = 86_400_000
const MAX_CELLS = 60
const PAID: OrderStatus[] = ['PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING', 'DISPOSAL_VERIFIED', 'COMPLETED']

const cache = new Map<string, { at: number; value: unknown }>()

async function overpass(query: string, timeoutMs: number): Promise<{ elements?: unknown[] } | null> {
  const key = createHash('sha256').update(query).digest('hex')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < DAY) return hit.value as { elements?: unknown[] }
  try {
    const res = await fetch(OVERPASS, { method: 'POST', headers: HEADERS, body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length > 5_000_000) return null // far more than a count query returns: refuse
    const value = JSON.parse(text)
    if (cache.size > 200) cache.clear()
    cache.set(key, { at: Date.now(), value })
    return value
  } catch {
    return null
  }
}

// Named places and per-square counts in one request; null counts when Overpass didn't answer in full.
async function osm(scan: ZoneBoundary, tiles: Tile[]): Promise<{ places: Place[]; counts: { buildings: number; pools: number }[] | null }> {
  const data = await overpass(overpassQuery(scan, tiles), 100_000)
  const places: Place[] = []
  const nums: number[] = []
  for (const el of (data?.elements ?? []) as { type?: string; lat?: number; lon?: number; tags?: { name?: string; total?: string } }[]) {
    if (el.type === 'count') nums.push(Number(el.tags?.total))
    else if (typeof el.lat === 'number' && typeof el.lon === 'number' && typeof el.tags?.name === 'string') places.push({ name: el.tags.name, lat: el.lat, lng: el.lon })
  }
  const ok = nums.length === tiles.length * 2 && nums.every((x) => Number.isFinite(x) && x >= 0)
  return { places, counts: ok ? tiles.map((_, i) => ({ buildings: nums[i * 2], pools: nums[i * 2 + 1] })) : null }
}

// Trashit's own paid orders in the last 180 days, counted per cell with their average value.
async function orderStats(scan: ZoneBoundary, cells: Cell[]) {
  const [w, s, e, n] = bbox(turfPolygon(scan.coordinates))
  const orders = await prisma.order.findMany({
    where: { status: { in: PAID }, createdAt: { gte: new Date(Date.now() - 180 * DAY) }, latitude: { gte: s, lte: n }, longitude: { gte: w, lte: e } },
    select: { latitude: true, longitude: true, pricePesewas: true },
    take: 20_000,
  })
  return cells.map((c) => {
    const mine = orders.filter((o) => o.latitude != null && o.longitude != null && containsPoint(c.boundary, o.latitude, o.longitude))
    const priced = mine.filter((o) => o.pricePesewas != null)
    return { orders: mine.length, avgOrderGhs: priced.length ? priced.reduce((t, o) => t + o.pricePesewas!, 0) / priced.length / 100 : null }
  })
}

export async function suggestZones(scan: ZoneBoundary, targetKm2: number): Promise<{ suggestions: Suggestion[]; usedPlaces: number; note: string | null }> {
  const existing = (await prisma.zone.findMany({ where: { active: true }, select: { boundary: true } })).map((z) => storedBoundary(z.boundary)).filter((b): b is ZoneBoundary => !!b)
  const tiles = scanTiles(scan)
  const { places, counts } = await osm(scan, tiles)
  const cells = buildCells(scan, places, existing, targetKm2).slice(0, MAX_CELLS)
  if (cells.length === 0) return { suggestions: [], usedPlaces: places.length, note: 'Nothing left to suggest: this area is already covered by zones, or too small.' }
  const c = cellCounts(cells, tiles, counts)
  const o = await orderStats(scan, cells)
  const withStats = cells.map((cell, i) => ({ ...cell, stats: { ...c[i], ...o[i] } as CellStats }))
  const note = c.every((x) => x.buildings == null) ? 'OpenStreetMap didn’t answer for buildings just now, so every suggestion is Standard. Try again in a few minutes.' : null
  return { suggestions: scoreCells(withStats), usedPlaces: places.length, note }
}
