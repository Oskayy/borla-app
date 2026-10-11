// Planner limits: trips per night, shift time, hazardous orders by hand, and trip time estimates.
import { describe, expect, it } from 'vitest'
import { buildDriverPlan, limitProblems, proposePlan, type PlanOrder, type PlanSite } from '@/lib/planner'
import type { DispatchDriver } from '@/lib/dispatch'
import { hasRoomTonight } from '@/lib/reassign'
import { durationLabel, shiftLengthMinutes, STOP_MINUTES, tripMinutes } from '@/lib/trip-time'
import { nightWork } from '@/lib/dispatch-server'

const NOW = new Date('2026-10-07T17:00:00Z')
const HOME = { lat: 5.67, lng: -0.01 }
const SITE: PlanSite = { id: 's', name: 'Site', lat: 5.698, lng: 0.045, acceptedWaste: ['general', 'recyclable'], usable: true, unloadMinutes: 15 }

function driver(over: Partial<DispatchDriver> = {}): DispatchDriver {
  return {
    id: 'd1',
    name: 'Ama',
    isActive: true,
    available: true,
    radiusKm: 5,
    capacityLitres: 1000, // 900 L per trip at 90%
    homeLat: HOME.lat,
    homeLng: HOME.lng,
    currentLat: null,
    currentLng: null,
    lastLocationAt: null,
    loadLitres: 0,
    tripsPerNight: 3,
    tripsUsed: 0,
    minutesLeft: 600,
    ...over,
  }
}

// n orders in a small cluster near home, `litres` each.
function orders(n: number, litres = 120, kind: PlanOrder['wasteKind'] = 'general'): PlanOrder[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `o${i}`,
    latitude: HOME.lat + (i % 5) * 0.002,
    longitude: HOME.lng + Math.floor(i / 5) * 0.002,
    litres,
    createdAt: new Date(NOW.getTime() - i * 60000).toISOString(),
    wasteKind: kind,
  }))
}

describe('trip time estimates', () => {
  it('counts collecting, driving and unloading', () => {
    const m = tripMinutes(HOME, [HOME, HOME], { ...SITE })
    expect(m).toBeGreaterThan(2 * STOP_MINUTES + 15) // plus the drive to the site
    expect(tripMinutes(null, [null], null)).toBe(STOP_MINUTES)
  })
  it('reads as a rounded duration', () => {
    expect(durationLabel(42)).toBe('about 40 min')
    expect(durationLabel(83)).toBe('about 1 h 25 min')
    expect(durationLabel(120)).toBe('about 2 h')
    expect(durationLabel(1)).toBe('about 5 min')
  })
  it('measures a shift across midnight', () => {
    expect(shiftLengthMinutes(1200, 360)).toBe(600)
  })
})

describe('planner limits', () => {
  it('gives every trip and plan a time', () => {
    const p = buildDriverPlan(driver(), orders(10), false, NOW, [SITE])
    expect(p.trips.length).toBe(2)
    expect(p.trips.every((t) => t.minutes > 0)).toBe(true)
    expect(p.minutes).toBe(p.trips.reduce((s, t) => s + t.minutes, 0))
    expect(p.problems).toEqual([])
  })

  it('flags a plan with more trips than the driver has left', () => {
    const p = buildDriverPlan(driver({ tripsUsed: 2 }), orders(10), false, NOW, [SITE])
    expect(p.problems.join(' ')).toMatch(/Needs 2 trips, only 1 left/)
    expect(limitProblems(driver({ tripsUsed: 3 }), 1, 10)[0]).toMatch(/No trips left/)
  })

  it('flags a plan longer than the time left in the shift', () => {
    const p = buildDriverPlan(driver({ minutesLeft: 30 }), orders(10), false, NOW, [SITE])
    expect(p.problems.join(' ')).toMatch(/left in the shift/)
  })

  it('never plans more trips than allowed, even when the litres would fit', () => {
    // 25 x 100 L = 2,500 L fits 3 x 900 L on paper, but full trips leave gaps, so some wait instead of a 4th trip.
    const plan = proposePlan([driver()], orders(25, 100).map((o) => ({ ...o, litres: o.id.endsWith('0') ? 400 : 100 })), false, NOW, [SITE])
    for (const p of plan.drivers) expect(p.trips.length).toBeLessThanOrEqual(3)
  })

  it('moves an order to the next driver when the closest one is out of time', () => {
    const tired = driver({ id: 'tired', minutesLeft: 5 })
    const fresh = driver({ id: 'fresh', homeLat: HOME.lat + 0.01 })
    const plan = proposePlan([tired, fresh], orders(3), false, NOW, [SITE])
    expect(plan.drivers.map((p) => p.driverId)).toEqual(['fresh'])
    expect(plan.unassigned).toEqual([])
  })

  it('says why when nobody has time left', () => {
    const plan = proposePlan([driver({ minutesLeft: 5 })], orders(2), false, NOW, [SITE])
    expect(plan.unassigned[0].reason).toMatch(/no time or trips left/)
  })

  it('leaves hazardous orders for ops to plan by hand', () => {
    const plan = proposePlan([driver()], [...orders(2), ...orders(1, 60, 'hazardous').map((o) => ({ ...o, id: 'haz' }))], false, NOW, [SITE])
    expect(plan.drivers[0].orderIds).not.toContain('haz')
    expect(plan.unassigned).toEqual([{ orderId: 'haz', reason: 'Hazardous waste: plan it by hand' }])
  })
})

describe('reassignment room', () => {
  const o = { id: 'x', latitude: HOME.lat, longitude: HOME.lng, litres: 120 }
  it('allows a new trip while trips are left', () => {
    expect(hasRoomTonight(driver({ tripsUsed: 2, loadLitres: 0 }), o, false, NOW)).toBe(true)
  })
  it('refuses when all trips are used and the open trip is full', () => {
    expect(hasRoomTonight(driver({ tripsUsed: 3, loadLitres: 850 }), o, false, NOW)).toBe(false)
  })
  it('allows topping up the open trip on the last trip', () => {
    expect(hasRoomTonight(driver({ tripsUsed: 3, loadLitres: 300 }), o, false, NOW)).toBe(true)
  })
  it('refuses when the shift has no time left', () => {
    expect(hasRoomTonight(driver({ minutesLeft: 2 }), o, false, NOW)).toBe(false)
  })
})

describe('work already assigned tonight', () => {
  const route = { driverId: 'd1', createdAt: NOW, trips: [{ tripNumber: 1, facility: { lat: SITE.lat, lng: SITE.lng, avgUnloadMinutes: 15 } }] }
  it('counts trips, and only open trips use time', () => {
    const done = nightWork(
      [{ routeId: 'r', tripNumber: 1, sequence: 1, order: { status: 'DISPOSAL_VERIFIED', latitude: HOME.lat, longitude: HOME.lng }, route }],
      HOME
    )
    expect(done).toEqual({ tripsUsed: 1, committedMinutes: 0 })
    const open = nightWork(
      [{ routeId: 'r', tripNumber: 1, sequence: 1, order: { status: 'ASSIGNED', latitude: HOME.lat, longitude: HOME.lng }, route }],
      HOME
    )
    expect(open.tripsUsed).toBe(1)
    expect(open.committedMinutes).toBeGreaterThan(STOP_MINUTES + 15)
  })
})
