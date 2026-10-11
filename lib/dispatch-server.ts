import { prisma } from '@/lib/prisma'
import { getMaxTripsPerNight, getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, isWithinShift, localParts } from '@/lib/shift'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { shiftLengthMinutes, tripMinutes, type Point } from '@/lib/trip-time'
import { worksNight } from '@/lib/availability'
import { coversShift, isOpenAt } from '@/lib/disposal-sites'
import type { PlanSite } from '@/lib/planner'
import { assessDriver, driverPosition, orderLitres, type DispatchDriver, type DispatchOrder, type DriverFit } from '@/lib/dispatch'

// Orders that are on a driver's vehicle or on their list and not yet unloaded.
// (DISPOSAL_PENDING is left out: the load is already off the vehicle, only the paperwork is waiting.)
export const LOAD_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP'] as const

const TO_COLLECT = new Set(['ASSIGNED', 'EN_ROUTE', 'ARRIVED'])
const OPEN = new Set<string>(LOAD_STATUSES)

type NightStop = {
  routeId: string
  tripNumber: number
  sequence: number
  order: { status: string; latitude: number | null; longitude: number | null }
  route: { driverId: string; createdAt: Date; trips: { tripNumber: number; facility: { lat: number | null; lng: number | null; avgUnloadMinutes: number } | null }[] }
}

// Trips a driver already has tonight, and the minutes their unfinished ones still need
// (from where they are now: collect what's left, then unload).
export function nightWork(stops: NightStop[], from: Point | null): { tripsUsed: number; committedMinutes: number } {
  const trips = new Map<string, NightStop[]>()
  for (const s of stops) {
    const key = `${s.routeId}:${s.tripNumber}`
    trips.set(key, [...(trips.get(key) ?? []), s])
  }
  const ordered = Array.from(trips.values()).sort(
    (a, b) => a[0].route.createdAt.getTime() - b[0].route.createdAt.getTime() || a[0].tripNumber - b[0].tripNumber
  )
  let committedMinutes = 0
  let here = from
  for (const t of ordered) {
    if (!t.some((s) => OPEN.has(s.order.status))) continue // finished: unloaded already
    const collect = t
      .filter((s) => TO_COLLECT.has(s.order.status))
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => (s.order.latitude != null && s.order.longitude != null ? { lat: s.order.latitude, lng: s.order.longitude } : null))
    const f = t[0].route.trips.find((x) => x.tripNumber === t[0].tripNumber)?.facility
    const site = f && f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng, unloadMinutes: f.avgUnloadMinutes } : null
    committedMinutes += tripMinutes(here, collect, site)
    if (site) here = site
  }
  return { tripsUsed: trips.size, committedMinutes: Math.round(committedMinutes) }
}

// Loads drivers with everything the dispatch rules need, including their current load in litres,
// the trips they've used tonight and the shift time they have left.
export async function loadDispatchDrivers(onlyDriverId?: string): Promise<{ drivers: DispatchDriver[]; shiftRunning: boolean; now: Date }> {
  const now = new Date()
  const [settings, tripsPerNight] = await Promise.all([getShiftSettings(), getMaxTripsPerNight()])
  const shiftRunning = isWithinShift(now, settings)
  const night = planningShiftDate(now, settings) // the running shift, or tonight's between shifts

  const users = await prisma.user.findMany({
    // Only approved drivers with an active account can be given work.
    where: { role: 'DRIVER', active: true, ...(onlyDriverId ? { id: onlyDriverId } : {}), driverProfile: { is: { approvalStatus: 'APPROVED' } } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      driverProfile: {
        select: {
          isActive: true,
          isOnline: true,
          onlineOverrideUntil: true,
          workNights: true,
          nightsOff: true,
          radiusKm: true,
          homeLat: true,
          homeLng: true,
          currentLat: true,
          currentLng: true,
          lastLocationAt: true,
          vehicleTypeRef: { select: { name: true, capacityLitres: true } },
        },
      },
      ordersAsDriver: {
        where: { status: { in: [...LOAD_STATUSES] } },
        select: { quoteSnapshot: true },
      },
    },
  })

  // Tonight's route stops (and any older ones still open), for trips used and time already committed.
  const nightStops: NightStop[] = users.length
    ? await prisma.routeStop.findMany({
        where: {
          route: { driverId: { in: users.map((u) => u.id) } },
          OR: [{ order: { status: { in: [...LOAD_STATUSES] } } }, { order: { shiftDate: dbDate(night) } }],
        },
        select: {
          routeId: true,
          tripNumber: true,
          sequence: true,
          order: { select: { status: true, latitude: true, longitude: true } },
          route: {
            select: {
              driverId: true,
              createdAt: true,
              trips: { select: { tripNumber: true, facility: { select: { lat: true, lng: true, avgUnloadMinutes: true } } } },
            },
          },
        },
      })
    : []
  // Time left in the shift: all of it when planning ahead, the rest of it once it's running.
  const shiftLength = shiftLengthMinutes(settings.shiftStartMinutes, settings.shiftEndMinutes)
  const budget = shiftRunning ? (settings.shiftEndMinutes - localParts(now, settings.timezone).minutes + 1440) % 1440 : shiftLength

  const drivers: DispatchDriver[] = users.map((u) => {
    const p = u.driverProfile!
    const d: DispatchDriver = {
      id: u.id,
      name: u.name,
      isActive: p.isActive,
      available: isDriverAvailable(p, now, settings),
      offNight: !worksNight(p, night),
      radiusKm: p.radiusKm,
      capacityLitres: p.vehicleTypeRef?.capacityLitres ?? null,
      homeLat: p.homeLat,
      homeLng: p.homeLng,
      currentLat: p.currentLat,
      currentLng: p.currentLng,
      lastLocationAt: p.lastLocationAt,
      loadLitres: u.ordersAsDriver.reduce((sum, o) => sum + orderLitres(o.quoteSnapshot).litres, 0),
      tripsPerNight,
      vehicleName: p.vehicleTypeRef?.name ?? null,
    }
    const pos = driverPosition(d, shiftRunning, now)
    const work = nightWork(
      nightStops.filter((s) => s.route.driverId === u.id),
      pos ? { lat: pos.lat, lng: pos.lng } : null
    )
    d.tripsUsed = work.tripsUsed
    d.minutesLeft = budget - work.committedMinutes
    return d
  })

  return { drivers, shiftRunning, now }
}

// Server-side check before assigning. Ops can override (e.g. a driver agreed to go further),
// but must give a reason, which is written to each order's audit log.
export async function checkAssignment(
  driverId: string,
  orders: { id: string; latitude: number | null; longitude: number | null; quoteSnapshot: unknown }[],
  override: unknown,
  overrideReason: unknown
): Promise<{ ok: boolean; error: string; note: string; fit: DriverFit }> {
  const { drivers, shiftRunning, now } = await loadDispatchDrivers(driverId)
  const driver = drivers[0]
  if (!driver) return { ok: false, error: 'Driver not found', note: '', fit: null as unknown as DriverFit }

  const dispatchOrders: DispatchOrder[] = orders.map((o) => ({
    id: o.id,
    latitude: o.latitude,
    longitude: o.longitude,
    litres: orderLitres(o.quoteSnapshot).litres,
  }))
  const fit = assessDriver(driver, dispatchOrders, shiftRunning, now)

  if (!driver.isActive) return { ok: false, error: 'This driver is paused', note: '', fit }
  if (fit.eligible) return { ok: true, error: '', note: '', fit }

  const reason = typeof overrideReason === 'string' ? overrideReason.trim().slice(0, 200) : ''
  if (override !== true) {
    return { ok: false, error: `This driver can't take these orders: ${fit.reasons.join('; ')}`, note: '', fit }
  }
  if (reason.length < 3) {
    return { ok: false, error: 'Please give a reason for overriding the driver checks', note: '', fit }
  }
  return { ok: true, error: '', note: ` [OVERRIDE: ${fit.reasons.join('; ')}. Reason: ${reason}]`, fit }
}

// Disposal sites for the planner. A site is usable if it is active, marked OPEN, and
// either open for the whole shift (when planning ahead) or open right now (during the shift).
export async function loadPlanSites(): Promise<PlanSite[]> {
  const now = new Date()
  const settings = await getShiftSettings()
  const shiftRunning = isWithinShift(now, settings)
  const minutesNow = localParts(now, settings.timezone).minutes

  const sites = await prisma.facility.findMany({
    where: { active: true, lat: { not: null }, lng: { not: null } },
    orderBy: { name: 'asc' },
  })
  return sites.map((f) => ({
    id: f.id,
    name: f.name,
    lat: f.lat!,
    lng: f.lng!,
    acceptedWaste: f.acceptedWaste,
    unloadMinutes: f.avgUnloadMinutes,
    usable:
      f.status === 'OPEN' &&
      (shiftRunning ? isOpenAt(f, minutesNow) : coversShift(f, settings.shiftStartMinutes, settings.shiftEndMinutes)),
  }))
}
