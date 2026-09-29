import { prisma } from '@/lib/prisma'
import { getMaxTripsPerNight, getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, isWithinShift, localParts } from '@/lib/shift'
import { coversShift, isOpenAt } from '@/lib/disposal-sites'
import type { PlanSite } from '@/lib/planner'
import { assessDriver, orderLitres, type DispatchDriver, type DispatchOrder, type DriverFit } from '@/lib/dispatch'

// Orders that are on a driver's vehicle or on their list and not yet unloaded.
// (DISPOSAL_PENDING is left out: the load is already off the vehicle, only the paperwork is waiting.)
export const LOAD_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP'] as const

// Loads drivers with everything the dispatch rules need, including their current load in litres.
export async function loadDispatchDrivers(onlyDriverId?: string): Promise<{ drivers: DispatchDriver[]; shiftRunning: boolean; now: Date }> {
  const now = new Date()
  const [settings, tripsPerNight] = await Promise.all([getShiftSettings(), getMaxTripsPerNight()])
  const shiftRunning = isWithinShift(now, settings)

  const users = await prisma.user.findMany({
    where: { role: 'DRIVER', ...(onlyDriverId ? { id: onlyDriverId } : {}), driverProfile: { isNot: null } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      driverProfile: {
        select: {
          isActive: true,
          isOnline: true,
          onlineOverrideUntil: true,
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

  const drivers: DispatchDriver[] = users.map((u) => {
    const p = u.driverProfile!
    return {
      id: u.id,
      name: u.name,
      isActive: p.isActive,
      available: isDriverAvailable(p, now, settings),
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
    usable:
      f.status === 'OPEN' &&
      (shiftRunning ? isOpenAt(f, minutesNow) : coversShift(f, settings.shiftStartMinutes, settings.shiftEndMinutes)),
  }))
}
