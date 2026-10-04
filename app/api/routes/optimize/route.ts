import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { checkAssignment } from '@/lib/dispatch-server'
import { notifyUser } from '@/lib/notify'
import { newStopsMessage } from '@/lib/offers'
import { getAcceptMinutes } from '@/lib/settings'
import { notifyCustomersAssigned } from '@/lib/customer-updates'
import { plannableOrderFilter } from '@/lib/schedule'
import { getShiftSettings } from '@/lib/settings'
import { caught } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'assign_orders', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderIds = body?.orderIds
  const driverId = body?.driverId

  if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 40 || !orderIds.every(isUuid) || !isUuid(driverId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const ids: string[] = Array.from(new Set(orderIds))

  const driver = await prisma.user.findFirst({
    where: { id: driverId, role: 'DRIVER', active: true, driverProfile: { isActive: true, approvalStatus: 'APPROVED' } },
  })
  if (!driver) return NextResponse.json({ error: 'Driver not found or inactive' }, { status: 400 })

  // Only tonight's orders (or older) can be assigned; later nights are planned on their own night.
  const tonight = plannableOrderFilter(new Date(), await getShiftSettings())
  // Radius, online status and vehicle capacity are checked here too, not just on the page.
  const toCheck = await prisma.order.findMany({
    where: { id: { in: ids }, status: 'PAID', ...tonight },
    select: { id: true, latitude: true, longitude: true, quoteSnapshot: true },
  })
  if (toCheck.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected orders are no longer available. Refresh and try again.' }, { status: 409 })
  }
  const check = await checkAssignment(driverId, toCheck, body?.override, body?.overrideReason)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 })

  const orders = await prisma.order.findMany({ where: { id: { in: ids }, status: 'PAID' } })
  if (orders.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected orders are no longer available. Refresh and try again.' }, { status: 409 })
  }

  const withCoords = orders.filter((o) => o.latitude != null && o.longitude != null)
  if (withCoords.length !== orders.length) {
    return NextResponse.json({ error: 'All orders in a route need coordinates' }, { status: 400 })
  }

  let orderedSequence: string[] = withCoords.map((o) => o.id) // fallback: original order

  if (withCoords.length > 1) {
    const coordsString = withCoords.map((o) => `${o.longitude},${o.latitude}`).join(';')

    try {
      const mapboxRes = await fetch(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordsString}?roundtrip=false&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        { signal: AbortSignal.timeout(8000) }
      )
      const mapboxData = await mapboxRes.json()

      if (mapboxData?.trips?.length > 0 && Array.isArray(mapboxData.waypoints)) {
        const waypointOrder = (mapboxData.waypoints as { waypoint_index: number }[])
          .map((wp, originalIndex) => ({ originalIndex, order: wp.waypoint_index }))
          .sort((a, b) => a.order - b.order)

        const optimized = waypointOrder.map((w) => withCoords[w.originalIndex]?.id)
        if (optimized.length === withCoords.length && optimized.every((id): id is string => Boolean(id))) {
          orderedSequence = optimized
        }
      }
    } catch (e) {
      // Optimization is a convenience, not a requirement: fall back to the original order.
      console.error('Route optimization failed, using original order:', e)
    }
  }

  try {
    const routeId = await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: { in: orderedSequence }, status: 'PAID' },
          data: { driverId, status: 'ASSIGNED', driverAcceptedAt: null, offeredAt: new Date() },
        })
        if (claimed.count !== orderedSequence.length) throw new Error('STATE_CHANGED')

        const route = await tx.route.create({ data: { driverId } })
        await tx.routeStop.createMany({
          data: orderedSequence.map((orderId, i) => ({ routeId: route.id, orderId, sequence: i + 1 })),
        })
        await tx.auditLog.createMany({
          data: orderedSequence.map((orderId) => ({
            orderId,
            actorId: auth.user.id,
            fromState: 'PAID',
            toState: 'ASSIGNED',
            reason: 'Assigned via route optimization' + check.note,
          })),
        })
        return route.id
      },
      { timeout: 15000 }
    )
    await notifyUser(driverId, newStopsMessage(orderedSequence.length, await getAcceptMinutes()))
    await notifyCustomersAssigned(orderedSequence)
    return NextResponse.json({ success: true, routeId, stopCount: orderedSequence.length })
  } catch (err) {
    const e = caught(err)
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'Some selected orders are no longer available. Refresh and try again.' }, { status: 409 })
    }
    console.error('[optimize] failed:', e)
    return NextResponse.json({ error: 'Could not assign orders. Please try again.' }, { status: 500 })
  }
}