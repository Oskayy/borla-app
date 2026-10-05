// Automatic planner: proposes which driver collects which order, grouped into trips.
// Pure functions (no database) so the same logic runs on the page (for live editing) and can be tested.
//
// How it decides:
//  1. Hardest orders first: those the fewest drivers can reach, then the oldest.
//  2. Each order goes to the eligible driver (online if the shift is running, within radius, with room left)
//     whose planned stops are closest to it, so each driver gets a tight cluster. Ties go to the emptier driver.
//  3. Each driver's stops are put in a sensible driving order (nearest next stop), then split into trips
//     that fill the vehicle to about 90% before a disposal run.

import { distanceInMeters } from './geo'
import { assessDriver, driverPosition, nightCapacity, tripCapacity, type DispatchDriver, type DispatchOrder } from './dispatch'

export type WasteKind = 'general' | 'recyclable' | 'hazardous'

export interface PlanOrder extends DispatchOrder {
  createdAt: string
  wasteKind?: WasteKind
  declinedBy?: string[] // drivers who turned this order down; never offered to them again
}

// A disposal site as the planner sees it. `usable` is worked out on the server:
// active, marked OPEN, and open for tonight's shift (or open right now during the shift).
export interface PlanSite {
  id: string
  name: string
  lat: number
  lng: number
  acceptedWaste: string[]
  usable: boolean
}

export interface PlannedTrip {
  tripNumber: number
  orderIds: string[]
  litres: number
  siteId: string | null // where this load is unloaded
  siteName: string | null
  siteProblem: string | null // e.g. no open site takes hazardous waste
}

export interface DriverPlan {
  driverId: string
  orderIds: string[] // in driving order
  trips: PlannedTrip[]
  litres: number // litres in this plan (on top of anything already assigned)
  distanceKm: number // rough straight-line length of the route, from the start point
  problems: string[] // rule breaks after manual edits (empty when the plan passes every check)
}

export interface Plan {
  drivers: DriverPlan[]
  unassigned: { orderId: string; reason: string }[]
}

// What kind of waste an order is, from its price snapshot.
export function orderWasteKind(snapshot: unknown): WasteKind {
  const s = snapshot as { wasteType?: unknown; hazardous?: unknown } | null
  if (s?.hazardous === true) return 'hazardous'
  return s?.wasteType === 'recyclable' ? 'recyclable' : 'general'
}

// Hazardous waste needs a site that takes hazardous waste. Recyclables go to a recycling site,
// or to a general site if none is available. General waste needs a general site.
export function siteAccepts(site: PlanSite, kinds: WasteKind[]): boolean {
  return kinds.every((k) =>
    k === 'recyclable' ? site.acceptedWaste.includes('recyclable') || site.acceptedWaste.includes('general') : site.acceptedWaste.includes(k)
  )
}

// The nearest usable site that accepts everything on this trip, measured from the trip's last stop.
export function chooseSite(
  tripOrders: PlanOrder[],
  sites: PlanSite[],
  from: { lat: number; lng: number } | null
): { site: PlanSite | null; problem: string | null } {
  if (sites.length === 0) return { site: null, problem: 'No disposal sites set up' }
  const kinds = Array.from(new Set(tripOrders.map((o) => o.wasteKind ?? 'general'))) as WasteKind[]
  const open = sites.filter((s) => s.usable)
  if (open.length === 0) return { site: null, problem: 'No disposal site is open tonight' }
  const accepting = open.filter((s) => siteAccepts(s, kinds))
  if (accepting.length === 0) {
    return { site: null, problem: `No open site accepts ${kinds.includes('hazardous') ? 'hazardous' : kinds.join(' and ')} waste` }
  }
  if (!from) return { site: accepting[0], problem: null }
  const nearest = accepting.reduce((best, s) =>
    distanceInMeters(from.lat, from.lng, s.lat, s.lng) < distanceInMeters(from.lat, from.lng, best.lat, best.lng) ? s : best
  )
  // Prefer a dedicated recycling site for all-recyclable loads when one is about as close.
  if (kinds.length === 1 && kinds[0] === 'recyclable' && !nearest.acceptedWaste.includes('recyclable')) {
    const recyclers = accepting.filter((s) => s.acceptedWaste.includes('recyclable'))
    if (recyclers.length > 0) {
      const r = recyclers.reduce((best, s) =>
        distanceInMeters(from.lat, from.lng, s.lat, s.lng) < distanceInMeters(from.lat, from.lng, best.lat, best.lng) ? s : best
      )
      if (distanceInMeters(from.lat, from.lng, r.lat, r.lng) <= distanceInMeters(from.lat, from.lng, nearest.lat, nearest.lng) * 1.5) {
        return { site: r, problem: null }
      }
    }
  }
  return { site: nearest, problem: null }
}

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => distanceInMeters(aLat, aLng, bLat, bLng) / 1000

// Puts stops in driving order: from the start point, always go to the nearest unvisited stop.
// Stops without coordinates go last.
export function orderStops(start: { lat: number; lng: number } | null, orders: PlanOrder[]): PlanOrder[] {
  const located = orders.filter((o) => o.latitude != null && o.longitude != null)
  const unlocated = orders.filter((o) => o.latitude == null || o.longitude == null)
  if (!start) return [...located, ...unlocated]

  const result: PlanOrder[] = []
  const left = [...located]
  let here = start
  while (left.length > 0) {
    let best = 0
    let bestKm = Infinity
    left.forEach((o, i) => {
      const d = km(here.lat, here.lng, o.latitude!, o.longitude!)
      if (d < bestKm) {
        bestKm = d
        best = i
      }
    })
    const next = left.splice(best, 1)[0]
    result.push(next)
    here = { lat: next.latitude!, lng: next.longitude! }
  }
  return [...result, ...unlocated]
}

// Splits stops (already in driving order) into trips of at most `perTrip` litres.
// The first trip is shorter if the driver already has orders on board.
export function splitIntoTrips(stops: PlanOrder[], perTrip: number, alreadyLoaded: number): PlannedTrip[] {
  const trips: PlannedTrip[] = []
  const blank = (n: number): PlannedTrip => ({ tripNumber: n, orderIds: [], litres: 0, siteId: null, siteName: null, siteProblem: null })
  let current: PlannedTrip = blank(1)
  let room = perTrip > 0 ? Math.max(0, perTrip - (alreadyLoaded % perTrip)) : Infinity
  for (const o of stops) {
    if (current.orderIds.length > 0 && o.litres > room) {
      trips.push(current)
      current = blank(current.tripNumber + 1)
      room = perTrip
    }
    current.orderIds.push(o.id)
    current.litres += o.litres
    room -= o.litres
  }
  if (current.orderIds.length > 0) trips.push(current)
  return trips
}

function routeLength(start: { lat: number; lng: number } | null, stops: PlanOrder[]): number {
  let total = 0
  let here = start
  for (const o of stops) {
    if (o.latitude == null || o.longitude == null) continue
    if (here) total += km(here.lat, here.lng, o.latitude, o.longitude)
    here = { lat: o.latitude, lng: o.longitude }
  }
  return Math.round(total * 10) / 10
}

// Builds one driver's plan from a chosen set of orders, and lists any rule breaks (used after manual edits).
export function buildDriverPlan(
  driver: DispatchDriver,
  orders: PlanOrder[],
  shiftRunning: boolean,
  now: Date,
  sites: PlanSite[] = []
): DriverPlan {
  const start = driverPosition(driver, shiftRunning, now)
  const stops = orderStops(start ? { lat: start.lat, lng: start.lng } : null, orders)
  const trips = splitIntoTrips(stops, tripCapacity(driver), driver.loadLitres)

  // End each trip at the best site for its load, measured from the trip's last stop.
  const byId = new Map(orders.map((o) => [o.id, o]))
  let lastPoint = start ? { lat: start.lat, lng: start.lng } : null
  for (const t of trips) {
    const tripOrders = t.orderIds.map((id) => byId.get(id)!)
    for (const o of tripOrders) if (o.latitude != null && o.longitude != null) lastPoint = { lat: o.latitude, lng: o.longitude }
    const { site, problem } = chooseSite(tripOrders, sites, lastPoint)
    t.siteId = site?.id ?? null
    t.siteName = site?.name ?? null
    t.siteProblem = problem
    if (site) lastPoint = { lat: site.lat, lng: site.lng } // the next trip starts from the site
  }
  const fit = orders.length > 0 ? assessDriver(driver, orders, shiftRunning, now) : null
  return {
    driverId: driver.id,
    orderIds: stops.map((o) => o.id),
    trips,
    litres: orders.reduce((s, o) => s + o.litres, 0),
    distanceKm: routeLength(start ? { lat: start.lat, lng: start.lng } : null, stops),
    problems: fit && !fit.eligible ? fit.reasons : [],
  }
}

export function proposePlan(
  drivers: DispatchDriver[],
  orders: PlanOrder[],
  shiftRunning: boolean,
  now: Date,
  sites: PlanSite[] = []
): Plan {
  // Who could take each order on its own?
  const candidates = new Map<string, DispatchDriver[]>()
  for (const o of orders) {
    const declined = new Set(o.declinedBy ?? [])
    candidates.set(o.id, drivers.filter((d) => !declined.has(d.id) && assessDriver(d, [o], shiftRunning, now).eligible))
  }

  const sorted = [...orders].sort((a, b) => {
    const ca = candidates.get(a.id)!.length
    const cb = candidates.get(b.id)!.length
    if (ca !== cb) return ca - cb
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const assigned = new Map<string, PlanOrder[]>() // driverId -> orders
  const used = new Map<string, number>() // driverId -> litres planned
  const unassigned: Plan['unassigned'] = []

  for (const o of sorted) {
    const options = candidates.get(o.id)!
    if (options.length === 0) {
      const anyone = drivers.map((d) => assessDriver(d, [o], shiftRunning, now))
      const reason =
        drivers.length === 0
          ? 'No drivers yet'
          : drivers.every((d) => d.offNight)
          ? 'No drivers working this night'
          : shiftRunning && anyone.every((f) => !f.counts)
          ? 'No drivers online'
          : 'No driver in range with room'
      unassigned.push({ orderId: o.id, reason })
      continue
    }

    let best: DispatchDriver | null = null
    let bestScore = Infinity
    for (const d of options) {
      const room = nightCapacity(d) - d.loadLitres - (used.get(d.id) ?? 0)
      if (o.litres > room) continue
      // Distance from this order to the driver's nearest planned stop (or their start point).
      const mine = assigned.get(d.id) ?? []
      const points = mine
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => ({ lat: m.latitude!, lng: m.longitude! }))
      const start = driverPosition(d, shiftRunning, now)
      if (start) points.push({ lat: start.lat, lng: start.lng })
      const score =
        o.latitude == null || o.longitude == null || points.length === 0
          ? 0
          : Math.min(...points.map((p) => km(p.lat, p.lng, o.latitude!, o.longitude!)))
      const tieBreak = (d.loadLitres + (used.get(d.id) ?? 0)) / Math.max(1, nightCapacity(d)) / 100
      if (score + tieBreak < bestScore) {
        bestScore = score + tieBreak
        best = d
      }
    }

    if (!best) {
      unassigned.push({ orderId: o.id, reason: 'Drivers in range are full for tonight' })
      continue
    }
    assigned.set(best.id, [...(assigned.get(best.id) ?? []), o])
    used.set(best.id, (used.get(best.id) ?? 0) + o.litres)
  }

  const plans = drivers
    .filter((d) => assigned.has(d.id))
    .map((d) => buildDriverPlan(d, assigned.get(d.id)!, shiftRunning, now, sites))
    .sort((a, b) => b.orderIds.length - a.orderIds.length)

  return { drivers: plans, unassigned }
}
