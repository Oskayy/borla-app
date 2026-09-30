import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { checkAssignment, loadDispatchDrivers, loadPlanSites } from '@/lib/dispatch-server'
import { orderLitres } from '@/lib/dispatch'
import { buildDriverPlan, orderWasteKind, type PlanOrder } from '@/lib/planner'
import { notifyUser } from '@/lib/notify'
import { newStopsMessage } from '@/lib/offers'
import { getAcceptMinutes } from '@/lib/settings'
import { notifyCustomersAssigned } from '@/lib/customer-updates'
import { plannableOrderFilter } from '@/lib/schedule'
import { getShiftSettings } from '@/lib/settings'

const MAX_DRIVERS_PER_REQUEST = 50
const MAX_ORDERS_PER_DRIVER = 60

// Approves one or more driver plans from the Assign page: assigns the orders, creates each driver's route
// with trip numbers, and logs everything. Each driver is handled separately, so one problem doesn't block the rest.
// The server rebuilds the route itself and re-checks radius, online status and capacity.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'approve_plan', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const plans = body?.plans
  if (!Array.isArray(plans) || plans.length === 0 || plans.length > MAX_DRIVERS_PER_REQUEST) {
    return NextResponse.json({ error: 'Nothing to approve' }, { status: 400 })
  }

  // Validate shape and make sure no order appears under two drivers.
  const seen = new Set<string>()
  for (const p of plans) {
    if (!isUuid(p?.driverId) || !Array.isArray(p?.orderIds) || p.orderIds.length === 0 || p.orderIds.length > MAX_ORDERS_PER_DRIVER) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    for (const id of p.orderIds) {
      if (!isUuid(id) || seen.has(id)) return NextResponse.json({ error: 'Invalid plan: an order appears twice' }, { status: 400 })
      seen.add(id)
    }
  }

  const results: { driverId: string; ok: boolean; message: string; stops?: number; trips?: number }[] = []
  const sites = await loadPlanSites()
  // Only tonight's orders (or older) can be approved; later nights are planned on their own night.
  const tonight = plannableOrderFilter(new Date(), await getShiftSettings())
  const siteIds = new Set((await prisma.facility.findMany({ where: { active: true }, select: { id: true } })).map((f) => f.id))

  for (const p of plans) {
    const driverId: string = p.driverId
    const ids: string[] = p.orderIds

    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, status: 'PAID', ...tonight },
      select: { id: true, latitude: true, longitude: true, quoteSnapshot: true, createdAt: true },
    })
    if (orders.length !== ids.length) {
      results.push({
        driverId,
        ok: false,
        message: 'Some orders were already assigned, changed, or are booked for a later night. Refresh the plan.',
      })
      continue
    }

    const declined = await prisma.orderDecline.count({ where: { driverId, orderId: { in: ids } } })
    if (declined > 0) {
      results.push({
        driverId,
        ok: false,
        message: `This driver declined ${declined} of these orders earlier. Move them to another driver, or use manual assign if the driver has agreed.`,
      })
      continue
    }

    const check = await checkAssignment(driverId, orders, p.override === true, p.overrideReason)
    if (!check.ok) {
      results.push({ driverId, ok: false, message: check.error })
      continue
    }

    // Rebuild the route and trips on the server.
    const { drivers, shiftRunning, now } = await loadDispatchDrivers(driverId)
    const planOrders: PlanOrder[] = orders.map((o) => ({
      id: o.id,
      latitude: o.latitude,
      longitude: o.longitude,
      litres: orderLitres(o.quoteSnapshot).litres,
      createdAt: o.createdAt.toISOString(),
      wasteKind: orderWasteKind(o.quoteSnapshot),
    }))
    const built = buildDriverPlan(drivers[0], planOrders, shiftRunning, now, sites)

    // Ops may pick a different site for a trip on the plan page ({ tripNumber: siteId }).
    const choices = p.siteChoices && typeof p.siteChoices === 'object' ? p.siteChoices : {}
    const siteFor = (tripNumber: number, planned: string | null) => {
      const chosen = choices[String(tripNumber)]
      return typeof chosen === 'string' && siteIds.has(chosen) ? chosen : planned
    }
    const tripOf = new Map<string, number>()
    built.trips.forEach((t) => t.orderIds.forEach((id) => tripOf.set(id, t.tripNumber)))

    try {
      await prisma.$transaction(
        async (tx) => {
          const claimed = await tx.order.updateMany({
            where: { id: { in: built.orderIds }, status: 'PAID' },
            data: { driverId, status: 'ASSIGNED', driverAcceptedAt: null, offeredAt: new Date() },
          })
          if (claimed.count !== built.orderIds.length) throw new Error('STATE_CHANGED')

          const route = await tx.route.create({ data: { driverId } })
          await tx.routeStop.createMany({
            data: built.orderIds.map((orderId, i) => ({
              routeId: route.id,
              orderId,
              sequence: i + 1,
              tripNumber: tripOf.get(orderId) ?? 1,
            })),
          })
          await tx.routeTrip.createMany({
            data: built.trips.map((t) => ({
              routeId: route.id,
              tripNumber: t.tripNumber,
              facilityId: siteFor(t.tripNumber, t.siteId),
            })),
          })
          await tx.auditLog.createMany({
            data: built.orderIds.map((orderId) => ({
              orderId,
              actorId: auth.user.id,
              fromState: 'PAID',
              toState: 'ASSIGNED',
              reason: `Assigned by approved plan (trip ${tripOf.get(orderId) ?? 1})${check.note}`,
            })),
          })
        },
        { timeout: 20000 }
      )
      results.push({ driverId, ok: true, message: 'Approved', stops: built.orderIds.length, trips: built.trips.length })
      await notifyCustomersAssigned(built.orderIds)
    } catch (e: any) {
      if (e?.message === 'STATE_CHANGED') {
        results.push({ driverId, ok: false, message: 'Some orders were already assigned or changed. Refresh the plan.' })
      } else {
        console.error('[approve-plan] failed:', e)
        results.push({ driverId, ok: false, message: 'Could not approve this driver. Please try again.' })
      }
    }
  }

  const approved = results.filter((r) => r.ok)
  if (approved.length > 0) {
    const acceptMinutes = await getAcceptMinutes()
    await Promise.all(approved.map((r) => notifyUser(r.driverId, newStopsMessage(r.stops ?? 0, acceptMinutes))))
  }
  if (approved.length > 0) {
    await logAdminAction(
      auth.user.id,
      'PLAN_APPROVED',
      null,
      `Approved ${approved.length} driver plan(s), ${approved.reduce((s, r) => s + (r.stops ?? 0), 0)} order(s)`
    )
  }

  return NextResponse.json({ results })
}
