// Dispatch rules: which drivers can take which orders. Pure functions (no database) so they can be tested.
//
// Two modes:
//  - During the shift: only drivers who are online count, measured from their live position
//    (or their home base if their phone hasn't sent a position recently).
//  - Outside the shift (planning tonight's work): every active driver counts, measured from their home base.
// A driver can take an order if it is within their radius and the load fits their vehicle.

import { distanceInMeters } from './geo'

export const LIVE_LOCATION_MAX_AGE_MINUTES = 15
export const CAPACITY_TARGET = 0.9 // plan trips to 90% full: bins are often overfilled
const FALLBACK_LITRES_PER_BAG = 60 // older orders only recorded a bag count

export interface DispatchDriver {
  id: string
  name: string
  isActive: boolean
  available: boolean // online now (see isDriverAvailable)
  offNight?: boolean // the driver marked this night as off (lib/availability.ts): dispatch leaves them out
  radiusKm: number | null
  capacityLitres: number | null
  homeLat: number | null
  homeLng: number | null
  currentLat: number | null
  currentLng: number | null
  lastLocationAt: Date | string | null
  loadLitres: number // litres already assigned and not yet unloaded
  tripsPerNight?: number // round trips the driver can do in a shift (default 1)
  tripsUsed?: number // trips already on the driver's routes tonight, finished or not
  minutesLeft?: number | null // estimated shift minutes left after the work already assigned (null = no time limit)
  vehicleName?: string | null
}

export interface DispatchOrder {
  id: string
  latitude: number | null
  longitude: number | null
  litres: number
}

export interface DriverPosition {
  lat: number
  lng: number
  source: 'live' | 'home'
}

// How much one driver can collect in a night: vehicle capacity x 90% x trips.
export function tripCapacity(d: DispatchDriver): number {
  return d.capacityLitres == null ? 0 : Math.floor(d.capacityLitres * CAPACITY_TARGET)
}
export function nightCapacity(d: DispatchDriver): number {
  return tripCapacity(d) * Math.max(1, d.tripsPerNight ?? 1)
}

// Litres for an order, from its price snapshot.
export function orderLitres(snapshot: unknown): { litres: number; estimated: boolean } {
  const s = snapshot as { totalLitres?: unknown; bagCount?: unknown } | null
  if (typeof s?.totalLitres === 'number' && s.totalLitres > 0) return { litres: s.totalLitres, estimated: false }
  const bags = typeof s?.bagCount === 'number' && s.bagCount > 0 ? s.bagCount : 1
  return { litres: bags * FALLBACK_LITRES_PER_BAG, estimated: true }
}

export function driverPosition(d: DispatchDriver, shiftRunning: boolean, now: Date): DriverPosition | null {
  if (shiftRunning && d.available && d.currentLat != null && d.currentLng != null && d.lastLocationAt) {
    const ageMin = (now.getTime() - new Date(d.lastLocationAt).getTime()) / 60000
    if (ageMin <= LIVE_LOCATION_MAX_AGE_MINUTES) return { lat: d.currentLat, lng: d.currentLng, source: 'live' }
  }
  if (d.homeLat != null && d.homeLng != null) return { lat: d.homeLat, lng: d.homeLng, source: 'home' }
  return null
}

export interface DriverFit {
  driverId: string
  counts: boolean // active, set up, and (during the shift) online
  position: DriverPosition | null
  maxDistanceKm: number | null // furthest selected order from the driver
  inRange: boolean // every selected order is within the driver's radius
  spareLitres: number | null // room left before the 90% target, before adding these orders
  fits: boolean // the selected orders fit in that room
  eligible: boolean // counts && inRange && fits
  reasons: string[] // plain-language reasons when not eligible
}

export function assessDriver(
  d: DispatchDriver,
  orders: DispatchOrder[],
  shiftRunning: boolean,
  now: Date
): DriverFit {
  const reasons: string[] = []
  const setUp = d.radiusKm != null && d.capacityLitres != null && d.homeLat != null
  let counts = d.isActive && setUp
  if (!d.isActive) reasons.push('Paused')
  else if (!setUp) reasons.push('Profile not finished')
  if (d.offNight) {
    counts = false
    reasons.push('Off this night (their availability)')
  }
  if (shiftRunning && !d.available) {
    counts = false
    reasons.push('Offline')
  }

  const position = driverPosition(d, shiftRunning, now)
  let maxDistanceKm: number | null = null
  let inRange = false
  const located = orders.filter((o) => o.latitude != null && o.longitude != null)
  if (position && located.length > 0) {
    maxDistanceKm = Math.max(
      ...located.map((o) => distanceInMeters(position.lat, position.lng, o.latitude!, o.longitude!) / 1000)
    )
    inRange = d.radiusKm != null && maxDistanceKm <= d.radiusKm
    if (!inRange && d.radiusKm != null) reasons.push(`Out of range (${maxDistanceKm.toFixed(1)} km, radius ${d.radiusKm} km)`)
  } else if (located.length === 0 && orders.length > 0) {
    inRange = true // no coordinates to check against; ops decide
  } else if (!position) {
    reasons.push('No location or home base')
  }

  let spareLitres: number | null = null
  let fits = false
  if (d.capacityLitres != null) {
    spareLitres = Math.max(0, Math.floor(nightCapacity(d) - d.loadLitres))
    const needed = orders.reduce((sum, o) => sum + o.litres, 0)
    fits = needed <= spareLitres
    if (!fits) reasons.push(`Not enough room (${needed} L needed, ${spareLitres} L free)`)
  }

  return {
    driverId: d.id,
    counts,
    position,
    maxDistanceKm,
    inRange,
    spareLitres,
    fits,
    eligible: counts && inRange && fits,
    reasons,
  }
}

// Ranks drivers for the selected orders: eligible first, then nearest.
export function rankDrivers(drivers: DispatchDriver[], orders: DispatchOrder[], shiftRunning: boolean, now: Date) {
  return drivers
    .map((d) => ({ driver: d, fit: assessDriver(d, orders, shiftRunning, now) }))
    .sort((a, b) => {
      if (a.fit.eligible !== b.fit.eligible) return a.fit.eligible ? -1 : 1
      if (a.fit.counts !== b.fit.counts) return a.fit.counts ? -1 : 1
      const da = a.fit.maxDistanceKm ?? Infinity
      const db = b.fit.maxDistanceKm ?? Infinity
      return da - db
    })
}

// How many drivers could take this one order on its own.
export function countDriversInRange(order: DispatchOrder, drivers: DispatchDriver[], shiftRunning: boolean, now: Date): number {
  return drivers.filter((d) => assessDriver(d, [order], shiftRunning, now).eligible).length
}
