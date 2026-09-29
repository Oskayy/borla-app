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

export interface PlanOrder extends DispatchOrder {
  createdAt: string
}

export interface PlannedTrip {
  tripNumber: number
  orderIds: string[]
  litres: number
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
  let current: PlannedTrip = { tripNumber: 1, orderIds: [], litres: 0 }
  let room = perTrip > 0 ? Math.max(0, perTrip - (alreadyLoaded % perTrip)) : Infinity
  for (const o of stops) {
    if (current.orderIds.length > 0 && o.litres > room) {
      trips.push(current)
      current = { tripNumber: current.tripNumber + 1, orderIds: [], litres: 0 }
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
  now: Date
): DriverPlan {
  const start = driverPosition(driver, shiftRunning, now)
  const stops = orderStops(start ? { lat: start.lat, lng: start.lng } : null, orders)
  const trips = splitIntoTrips(stops, tripCapacity(driver), driver.loadLitres)
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

export function proposePlan(drivers: DispatchDriver[], orders: PlanOrder[], shiftRunning: boolean, now: Date): Plan {
  // Who could take each order on its own?
  const candidates = new Map<string, DispatchDriver[]>()
  for (const o of orders) {
    candidates.set(o.id, drivers.filter((d) => assessDriver(d, [o], shiftRunning, now).eligible))
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
    .map((d) => buildDriverPlan(d, assigned.get(d.id)!, shiftRunning, now))
    .sort((a, b) => b.orderIds.length - a.orderIds.length)

  return { drivers: plans, unassigned }
}
