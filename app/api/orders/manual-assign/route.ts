import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { checkAssignment } from '@/lib/dispatch-server'

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
    where: { id: driverId, role: 'DRIVER', driverProfile: { isActive: true } },
  })
  if (!driver) return NextResponse.json({ error: 'Driver not found or inactive' }, { status: 400 })

  // Radius, online status and vehicle capacity are checked here too, not just on the page.
  const toCheck = await prisma.order.findMany({
    where: { id: { in: ids }, status: 'PAID' },
    select: { id: true, latitude: true, longitude: true, quoteSnapshot: true },
  })
  if (toCheck.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected orders are no longer available. Refresh and try again.' }, { status: 409 })
  }
  const check = await checkAssignment(driverId, toCheck, body?.override, body?.overrideReason)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 })

  try {
    const routeId = await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: { in: ids }, status: 'PAID' },
          data: { driverId, status: 'ASSIGNED' },
        })
        if (claimed.count !== ids.length) throw new Error('STATE_CHANGED')

        const route = await tx.route.create({ data: { driverId } })
        await tx.routeStop.createMany({
          data: ids.map((orderId, i) => ({ routeId: route.id, orderId, sequence: i + 1 })),
        })
        await tx.auditLog.createMany({
          data: ids.map((orderId) => ({
            orderId,
            actorId: auth.user.id,
            fromState: 'PAID',
            toState: 'ASSIGNED',
            reason: 'Manually assigned (no coordinates available for route optimization)' + check.note,
          })),
        })
        return route.id
      },
      { timeout: 15000 }
    )
    return NextResponse.json({ success: true, routeId, stopCount: ids.length })
  } catch (e: any) {
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'Some selected orders are no longer available. Refresh and try again.' }, { status: 409 })
    }
    console.error('[manual-assign] failed:', e)
    return NextResponse.json({ error: 'Could not assign orders. Please try again.' }, { status: 500 })
  }
}