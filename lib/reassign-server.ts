import { prisma } from '@/lib/prisma'
import { LOAD_STATUSES, loadDispatchDrivers, loadPlanSites } from '@/lib/dispatch-server'
import { orderLitres, type DispatchDriver } from '@/lib/dispatch'
import { chooseSite, orderWasteKind, type PlanOrder, type PlanSite } from '@/lib/planner'
import { pickReplacement, placeOnRoute, type RouteTripLoad } from '@/lib/reassign'
import { notifyUser, notifyOps } from '@/lib/notify'
import { newStopsMessage } from '@/lib/offers'
import { getAcceptMinutes } from '@/lib/settings'
import { notifyCustomersAssigned } from '@/lib/customer-updates'
import { caught } from '@/lib/errors'

const LOAD = new Set<string>(LOAD_STATUSES)

export interface AttachableOrder {
  id: string
  latitude: number | null
  longitude: number | null
  quoteSnapshot: unknown
  createdAt: Date
}

// Adds one PAID, unassigned order to a driver's current route: on their last trip if it hasn't been unloaded
// and has room, otherwise on a new trip ending at the best disposal site. Creates a route if they have none.
// The driver then has to accept it. Throws Error('STATE_CHANGED') if the order was taken in the meantime.
export async function attachOrderToDriver(
  order: AttachableOrder,
  driver: DispatchDriver,
  sites: PlanSite[],
  actorId: string | null,
  describe: (tripNumber: number, newTrip: boolean) => string
): Promise<number> {
  const trip = await attachInner(order, driver, sites, actorId, describe)
  await notifyCustomersAssigned([order.id])
  return trip
}

async function attachInner(
  order: AttachableOrder,
  driver: DispatchDriver,
  sites: PlanSite[],
  actorId: string | null,
  describe: (tripNumber: number, newTrip: boolean) => string // audit log text
): Promise<number> {
  const litres = orderLitres(order.quoteSnapshot).litres
  const planOrder: PlanOrder = {
    id: order.id,
    latitude: order.latitude,
    longitude: order.longitude,
    litres,
    createdAt: order.createdAt.toISOString(),
    wasteKind: orderWasteKind(order.quoteSnapshot),
  }

  return prisma.$transaction(
    async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PAID', driverId: null },
        data: { driverId: driver.id, status: 'ASSIGNED', driverAcceptedAt: null, offeredAt: new Date() },
      })
      if (claimed.count !== 1) throw new Error('STATE_CHANGED')

      // The driver's current route (one with stops still to collect or unload), if any.
      const route = await tx.route.findFirst({
        where: { driverId: driver.id, stops: { some: { order: { status: { in: [...LOAD_STATUSES] } } } } },
        orderBy: { createdAt: 'desc' },
        include: {
          trips: true,
          stops: { include: { order: { select: { status: true, quoteSnapshot: true, latitude: true, longitude: true } } } },
        },
      })

      let routeId: string
      let sequence = 1
      let placement: { tripNumber: number; newTrip: boolean }
      let from: { lat: number; lng: number } | null = null

      if (route) {
        routeId = route.id
        sequence = Math.max(0, ...route.stops.map((s: { sequence: number }) => s.sequence)) + 1
        const numbers = new Set<number>([
          ...route.trips.map((t: { tripNumber: number }) => t.tripNumber),
          ...route.stops.map((s: { tripNumber: number }) => s.tripNumber),
        ])
        const loads: RouteTripLoad[] = Array.from(numbers).map((n) => {
          const stops = route.stops.filter((s: { tripNumber: number }) => s.tripNumber === n)
          const open = stops.filter((s: { order: { status: string } }) => LOAD.has(s.order.status))
          return {
            tripNumber: n,
            litresOnBoardOrPlanned: open.reduce(
              (sum: number, s: { order: { quoteSnapshot: unknown } }) => sum + orderLitres(s.order.quoteSnapshot).litres,
              0
            ),
            finished: stops.length > 0 && open.length === 0,
          }
        })
        placement = placeOnRoute(loads, litres, driver)
        const last = [...route.stops]
          .sort((a: { sequence: number }, b: { sequence: number }) => b.sequence - a.sequence)
          .find((s: { order: { latitude: number | null } }) => s.order.latitude != null)
        if (last) from = { lat: last.order.latitude!, lng: last.order.longitude! }
      } else {
        const created = await tx.route.create({ data: { driverId: driver.id } })
        routeId = created.id
        placement = { tripNumber: 1, newTrip: true }
      }

      await tx.routeStop.create({ data: { routeId, orderId: order.id, sequence, tripNumber: placement.tripNumber } })

      // Make sure the trip has a disposal site.
      const existingTrip = route?.trips.find((t: { tripNumber: number }) => t.tripNumber === placement.tripNumber)
      if (!existingTrip) {
        const start = from ?? (order.latitude != null && order.longitude != null ? { lat: order.latitude, lng: order.longitude } : null)
        const { site } = chooseSite([planOrder], sites, start)
        await tx.routeTrip.create({ data: { routeId, tripNumber: placement.tripNumber, facilityId: site?.id ?? null } })
      }

      await tx.auditLog.create({
        data: {
          orderId: order.id,
          actorId,
          fromState: 'PAID',
          toState: 'ASSIGNED',
          reason: describe(placement.tripNumber, placement.newTrip),
        },
      })
      return placement.tripNumber
    },
    { timeout: 20000 }
  )
}

export interface ReassignOutcome {
  reassigned: boolean
  driverId: string | null
  driverName: string | null
  tripNumber: number | null
  reason: string // why it wasn't reassigned (empty when it was)
}

// Gives a PAID, unassigned order to the best driver who hasn't declined it, and adds it to that driver's route.
// If nobody can take it, the order stays PAID, ops are told, and it shows up on the Assign page.
export async function reassignOrder(orderId: string, actorId: string | null): Promise<ReassignOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, driverId: true, latitude: true, longitude: true, quoteSnapshot: true, createdAt: true },
  })
  if (!order || order.status !== 'PAID' || order.driverId) {
    return { reassigned: false, driverId: null, driverName: null, tripNumber: null, reason: 'Order is no longer waiting for a driver' }
  }

  const declines = await prisma.orderDecline.findMany({ where: { orderId }, select: { driverId: true } })
  const declinedBy: string[] = declines.map((d: { driverId: string }) => d.driverId)

  const { drivers, shiftRunning, now } = await loadDispatchDrivers()
  const litres = orderLitres(order.quoteSnapshot).litres
  const pick = pickReplacement(
    drivers,
    { id: order.id, latitude: order.latitude, longitude: order.longitude, litres },
    declinedBy,
    shiftRunning,
    now
  )
  const address = (order.quoteSnapshot as { address?: string } | null)?.address ?? 'An order'

  if (!pick.driver) {
    await prisma.auditLog.create({
      data: {
        orderId,
        actorId,
        fromState: 'PAID',
        toState: 'PAID',
        reason: `NEEDS DRIVER: could not reassign automatically (${pick.reason}). Assign it from the Assign page.`,
      },
    })
    await notifyOps({
      title: 'Order needs a driver',
      body: `${address} was declined or not accepted, and no other driver can take it (${pick.reason}). Assign it from the Assign page.`,
      url: '/ops/assign',
    })
    return { reassigned: false, driverId: null, driverName: null, tripNumber: null, reason: pick.reason }
  }

  const driver = pick.driver
  const sites = await loadPlanSites()
  try {
    const tripNumber = await attachOrderToDriver(
      order,
      driver,
      sites,
      actorId,
      (trip, newTrip) => `Reassigned automatically to ${driver.name} after a decline (trip ${trip}${newTrip ? ', new trip' : ''})`
    )
    const msg = newStopsMessage(1, await getAcceptMinutes())
    await notifyUser(driver.id, { ...msg, title: 'New stop added to your route', body: `${address}. ${msg.body}` })
    return { reassigned: true, driverId: driver.id, driverName: driver.name, tripNumber, reason: '' }
  } catch (err) {
    const e = caught(err)
    if (e?.message === 'STATE_CHANGED') {
      return { reassigned: false, driverId: null, driverName: null, tripNumber: null, reason: 'Order was changed by someone else' }
    }
    console.error('[reassign] failed:', e)
    await prisma.auditLog.create({
      data: { orderId, actorId, fromState: 'PAID', toState: 'PAID', reason: 'NEEDS DRIVER: automatic reassignment failed. Assign it from the Assign page.' },
    })
    return { reassigned: false, driverId: null, driverName: null, tripNumber: null, reason: 'Automatic reassignment failed' }
  }
}
