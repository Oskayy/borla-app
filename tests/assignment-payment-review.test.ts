// The assignment and payment review (22 Nov 2026): who counts as present, home base moves, the planner's batch
// matching and 2-opt, the distance bonus cap, unload proof, pickup holds, customer reports, the partial sweep,
// new-driver clearing, and the routes that use them.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { driverPresence, NEAR_ZONE_KM, presenceHint, type PresenceInput } from '@/lib/presence'
import { circleToBoundary, distanceToShapeKm } from '@/lib/zone-shape'
import { planHomeChange } from '@/lib/home-change'
import { proposePlan, twoOpt, type PlanOrder } from '@/lib/planner'
import type { DispatchDriver } from '@/lib/dispatch'
import { distanceBonus } from '@/lib/money-split'
import { parseTicket, sameCode, unloadNeedsReview } from '@/lib/unload-checks'
import { pickupChecks } from '@/lib/plausibility'
import { parseReport, reportOptions } from '@/lib/customer-reports'
import { fitToBalance } from '@/lib/treasury'
import { TRANSFER_FEE_PESEWAS } from '@/lib/accounts'
import { CLEARING_HOURS, clearingHoursFor, NEW_DRIVER_CLEARING_HOURS } from '@/lib/earnings'
import { DEFAULT_SHIFT_SETTINGS } from '@/lib/shift'
import { distanceInMeters } from '@/lib/geo'

const src = (p: string) => readFileSync(path.resolve(__dirname, '..', p), 'utf8')
const S = DEFAULT_SHIFT_SETTINGS // 8pm-6am Accra (UTC all year)
const NIGHT = new Date('2026-11-20T21:00:00Z') // 9pm, shift running
const ZONE_CENTRE = { lat: 5.6, lng: -0.2 }
const zone = { name: 'Osu', boundary: circleToBoundary(ZONE_CENTRE.lat, ZONE_CENTRE.lng, 2) }
const KM_LAT = 1 / 111.19 // degrees of latitude in 1 km

function presence(over: Partial<PresenceInput> = {}): PresenceInput {
  return {
    isOnline: true,
    onlineOverrideUntil: null,
    currentLat: ZONE_CENTRE.lat,
    currentLng: ZONE_CENTRE.lng,
    lastLocationAt: new Date(NIGHT.getTime() - 60_000),
    homeLat: ZONE_CENTRE.lat,
    homeLng: ZONE_CENTRE.lng,
    radiusKm: 5,
    zone,
    ...over,
  }
}

describe('presence: online, a recent location, in or near the working zone', () => {
  it('counts a driver online in their zone', () => {
    expect(driverPresence(presence(), NIGHT, S)).toMatchObject({ state: 'present', available: true })
  })
  it('does not count a driver who tapped online but sent no location, or none for 15 minutes', () => {
    expect(driverPresence(presence({ currentLat: null, lastLocationAt: null }), NIGHT, S).state).toBe('no_location')
    const stale = driverPresence(presence({ lastLocationAt: new Date(NIGHT.getTime() - 20 * 60_000) }), NIGHT, S)
    expect(stale).toMatchObject({ state: 'stale_location', available: false })
    expect(stale.reason).toContain('20 min')
  })
  it('allows a driver just outside the zone, not one far away', () => {
    // The zone is a 2 km circle: 2 + NEAR_ZONE_KM - 0.5 km from the centre is near, 2 + NEAR_ZONE_KM + 1 is not.
    const near = driverPresence(presence({ currentLat: ZONE_CENTRE.lat + (2 + NEAR_ZONE_KM - 0.5) * KM_LAT }), NIGHT, S)
    expect(near.available).toBe(true)
    const far = driverPresence(presence({ currentLat: ZONE_CENTRE.lat + (2 + NEAR_ZONE_KM + 1) * KM_LAT }), NIGHT, S)
    expect(far).toMatchObject({ state: 'away', available: false })
    expect(far.reason).toContain('outside Osu')
    expect(presenceHint(far)).toContain('outside your working area')
  })
  it('uses the home base and radius for a driver with no zone', () => {
    const p = presence({ zone: null, radiusKm: 3, currentLat: ZONE_CENTRE.lat + (3 + NEAR_ZONE_KM + 1) * KM_LAT })
    expect(driverPresence(p, NIGHT, S).state).toBe('away')
    expect(driverPresence({ ...p, currentLat: ZONE_CENTRE.lat + 4 * KM_LAT }, NIGHT, S).available).toBe(true)
  })
  it('is offline outside the shift without an ops override', () => {
    const noon = new Date('2026-11-20T12:00:00Z')
    expect(driverPresence(presence({ lastLocationAt: noon }), noon, S).state).toBe('offline')
  })
  it('measures the distance to an outline', () => {
    expect(distanceToShapeKm(zone.boundary, ZONE_CENTRE.lat, ZONE_CENTRE.lng)).toBe(0)
    const d = distanceToShapeKm(zone.boundary, ZONE_CENTRE.lat + 5 * KM_LAT, ZONE_CENTRE.lng)
    expect(d).toBeGreaterThan(2.9)
    expect(d).toBeLessThan(3.1)
  })
})

describe('home base moves wait for ops', () => {
  const current = { homeLat: 5.6, homeLng: -0.2, zoneId: 'z1' }
  it('saves at once before approval, and for a small correction', () => {
    expect(planHomeChange({ approved: false, current, requested: { homeLat: 5.7, homeLng: -0.2, zoneId: 'z2' } }).kind).toBe('now')
    expect(planHomeChange({ approved: true, current, requested: { homeLat: 5.6005, homeLng: -0.2, zoneId: 'z1' } }).kind).toBe('now')
  })
  it('waits for ops when an approved driver moves far or changes zone', () => {
    const far = planHomeChange({ approved: true, current, requested: { homeLat: 5.65, homeLng: -0.2, zoneId: 'z1' } })
    expect(far.kind).toBe('pending')
    expect(far.movedKm).toBeGreaterThan(5)
    expect(planHomeChange({ approved: true, current, requested: { homeLat: 5.6, homeLng: -0.2, zoneId: 'z2' } }).kind).toBe('pending')
  })
})

describe('planner: batch matching and 2-opt', () => {
  const drv = (id: string, lat: number, lng: number, over: Partial<DispatchDriver> = {}): DispatchDriver => ({
    id,
    name: id,
    isActive: true,
    available: true,
    radiusKm: 20,
    capacityLitres: 10_000,
    homeLat: lat,
    homeLng: lng,
    currentLat: null,
    currentLng: null,
    lastLocationAt: null,
    loadLitres: 0,
    tripsPerNight: 3,
    tripsUsed: 0,
    minutesLeft: 600,
    ...over,
  })
  const order = (id: string, lat: number, lng: number, over: Partial<PlanOrder> = {}): PlanOrder => ({
    id,
    latitude: lat,
    longitude: lng,
    litres: 100,
    createdAt: '2026-11-20T10:00:00Z',
    ...over,
  })

  it('2-opt removes a crossing that nearest-next leaves', () => {
    const start = { lat: 0, lng: 0 }
    const route = [order('a', 0, 1), order('b', 1, 2), order('c', 0, 2), order('d', 1, 1)]
    const len = (r: PlanOrder[]) =>
      r.reduce((s, o, i) => {
        const p = i === 0 ? start : { lat: r[i - 1].latitude!, lng: r[i - 1].longitude! }
        return s + distanceInMeters(p.lat, p.lng, o.latitude!, o.longitude!)
      }, 0)
    const better = twoOpt(start, route)
    expect(len(better)).toBeLessThan(len(route))
    expect(better.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('places first the order that loses most if its best driver is taken (regret), not simply the oldest', () => {
    // d1 has room for one order. o1 is next to d1 and 3 km from d2; the older o2 is about as far from both.
    // Oldest-first would give o2 to d1 and send d2 3 km for o1; regret gives o1 to d1 and o2 to d2.
    const d1 = drv('d1', 5.6, -0.2, { capacityLitres: 120, tripsPerNight: 1 }) // 108 L a night at 90%: one 100 L order
    const d2 = drv('d2', 5.6, -0.17)
    const o1 = order('o1', 5.6, -0.2005, { createdAt: '2026-11-20T12:00:00Z' })
    const o2 = order('o2', 5.6, -0.186, { createdAt: '2026-11-20T09:00:00Z' })
    const plan = proposePlan([d1, d2], [o2, o1], true, NIGHT)
    const of = (id: string) => plan.drivers.find((p) => p.orderIds.includes(id))?.driverId
    expect(of('o1')).toBe('d1')
    expect(of('o2')).toBe('d2')
    expect(plan.unassigned).toEqual([])
  })
})

describe('distance bonus never costs Trashit money', () => {
  const rule = { freeKm: 3, perKmPesewas: 100, capPesewas: 1000 }
  it('is capped at what Trashit keeps after the Paystack fee', () => {
    // GHS 30 order: fee 4.50, Paystack 0.59, Trashit keeps 3.91. A 20 km stop would earn GHS 10, capped at 3.91.
    expect(distanceBonus(20, rule, 450 - 59)).toBe(391)
    expect(distanceBonus(3.6, rule, 391)).toBe(60)
    expect(distanceBonus(10, rule, 0)).toBe(0)
  })
})

describe('unload proof', () => {
  const site = { geofenceRadiusM: 150, unloadCode: null, ticketRequired: false }
  const proof = { distanceM: 120, code: null, ticket: null, ticketUsedBefore: false, cleanRecord: false }
  it('pays inside the geofence, and further out for a clean record', () => {
    expect(unloadNeedsReview(site, proof)).toBeNull()
    expect(unloadNeedsReview(site, { ...proof, distanceM: 300 })).toContain('300 m')
    expect(unloadNeedsReview(site, { ...proof, distanceM: 300, cleanRecord: true })).toBeNull()
    expect(unloadNeedsReview(site, { ...proof, distanceM: null })).toContain('no GPS')
    expect(unloadNeedsReview(null, proof)).toContain('no disposal site')
  })
  it('checks the gate code and ticket numbers', () => {
    const coded = { ...site, unloadCode: 'KP42' }
    expect(unloadNeedsReview(coded, proof)).toBe('no site code was typed')
    expect(unloadNeedsReview(coded, { ...proof, code: 'kp 42' })).toBeNull()
    expect(unloadNeedsReview(coded, { ...proof, code: 'KP41' })).toContain("didn't match")
    expect(unloadNeedsReview({ ...site, ticketRequired: true }, { ...proof, ticket: 'A123', ticketUsedBefore: true })).toContain('already used')
    expect(sameCode(null, 'x')).toBe(false)
    expect(parseTicket(' wb-00123 ')).toBe('WB-00123')
    expect(parseTicket('x')).toBeNull()
  })
})

describe('pickup checks: serious ones hold the pay', () => {
  const at = new Date('2026-11-20T21:00:00Z')
  const pin = { lat: 5.6, lng: -0.2 }
  it('treats weak GPS as a flag only, a far photo or a live-position mismatch as serious', () => {
    const weak = pickupChecks({ gps: pin, accuracyM: 300, pin, previous: null, at, photoUsedElsewhere: false })
    expect(weak.flags).toHaveLength(1)
    expect(weak.serious).toEqual([])
    const far = pickupChecks({ gps: { lat: 5.61, lng: -0.2 }, accuracyM: 10, pin, previous: null, at, photoUsedElsewhere: false })
    expect(far.serious[0]).toContain('GPS MISMATCH')
    const live = pickupChecks({ gps: pin, accuracyM: 10, pin, previous: null, at, photoUsedElsewhere: false, live: { lat: 5.65, lng: -0.2, at } })
    expect(live.serious[0]).toContain('from where the phone was')
    const oldLive = pickupChecks({ gps: pin, accuracyM: 10, pin, previous: null, at, photoUsedElsewhere: false, live: { lat: 5.65, lng: -0.2, at: new Date(at.getTime() - 30 * 60_000) } })
    expect(oldLive.serious).toEqual([])
  })
})

describe('customer reports', () => {
  const now = new Date('2026-11-21T09:00:00Z')
  const pickedUp = new Date('2026-11-20T22:00:00Z')
  it('lets a customer report a problem for 72 hours after collection, once', () => {
    expect(reportOptions({ status: 'COMPLETED' }, pickedUp, now, false)).toEqual({ problems: true, gateReply: false })
    expect(reportOptions({ status: 'COMPLETED' }, pickedUp, new Date('2026-11-24T23:00:00Z'), false).problems).toBe(false)
    expect(reportOptions({ status: 'COMPLETED' }, pickedUp, now, true).problems).toBe(false)
    expect(reportOptions({ status: 'PAID' }, null, now, false).problems).toBe(false)
  })
  it('lets a customer answer a gate-locked report', () => {
    expect(reportOptions({ status: 'FAILED_PICKUP' }, null, now, false)).toEqual({ problems: false, gateReply: true })
    expect('error' in parseReport({ kind: 'GATE_REPLY', note: '' })).toBe(true)
    expect(parseReport({ kind: 'NOT_COLLECTED' })).toMatchObject({ ok: true, kind: 'NOT_COLLECTED' })
    expect('error' in parseReport({ kind: 'REFUND_ME' })).toBe(true)
  })
})

describe('payout sweep: partial when the balance is short', () => {
  const plan = { auto: [{ driverId: 'a', amount: 5000 }, { driverId: 'b', amount: 2000 }, { driverId: 'c', amount: 9000 }], forFinance: [] }
  it('pays everyone when the balance covers it', () => {
    expect(fitToBalance(plan, 20_000).later).toEqual([])
  })
  it('pays the smallest balances first and keeps the rest', () => {
    const fit = fitToBalance(plan, 7_200)
    expect(fit.send.auto.map((p) => p.driverId)).toEqual(['b', 'a'])
    expect(fit.later.map((p) => p.driverId)).toEqual(['c'])
    expect(fit.shortBy).toBe(16_000 + 3 * TRANSFER_FEE_PESEWAS - 7_200)
  })
  it('pays nobody when Paystack does not report the balance', () => {
    expect(fitToBalance(plan, null).send.auto).toEqual([])
  })
})

describe('new drivers clear more slowly', () => {
  const now = new Date('2026-11-21T09:00:00Z')
  it('uses the longer period for the first 30 days', () => {
    expect(clearingHoursFor(new Date('2026-11-10T09:00:00Z'), now)).toBe(NEW_DRIVER_CLEARING_HOURS)
    expect(clearingHoursFor(new Date('2026-09-10T09:00:00Z'), now)).toBe(CLEARING_HOURS)
    expect(clearingHoursFor(null, now)).toBe(CLEARING_HOURS)
  })
})

describe('the routes use these rules', () => {
  it('confirms payments the same way from the webhook and from a Paystack check', () => {
    expect(src('app/api/payments/webhook/route.ts')).toContain("confirmCharge(event.data, 'webhook')")
    expect(src('lib/payment-confirm-server.ts')).toContain("confirmCharge(r.data, 'verify')")
  })
  it('re-prices a draft at checkout and keeps our own reference', () => {
    const init = src('app/api/payments/initialize/route.ts')
    expect(init).toContain('requoteDraft(order)')
    expect(init).toContain('paystackReference: reference')
  })
  it('never deletes a draft whose checkout may still be paid', () => {
    expect(src('app/api/orders/delete-draft/route.ts')).toContain('draftDeletable(')
  })
  it('counts the whole order for the refund second approver', () => {
    expect(src('lib/refunds-server.ts')).toContain('needsSecondApprover((staffBefore + Math.round(amount * 100)) / 100)')
  })
  it('requires GPS on pickups and proof on locked-gate reports', () => {
    expect(src('app/api/orders/confirm-pickup/route.ts')).toContain('needsGps: true')
    expect(src('app/api/orders/report-issue/route.ts')).toContain("issueType === 'LOCKED_GATE' && (photoPath === null")
  })
  it('only lets senior ops override driver checks', () => {
    expect(src('lib/dispatch-server.ts')).toContain('if (!OVERRIDE_ROLES.includes(actorRole))')
  })
})
