import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { DISPOSAL_REVIEW_ROLES, releaseDisposal } from '@/lib/disposal-release'

// Ops decide on unloads that couldn't be checked automatically (photo outside the site's geofence, or no GPS).
// approve: the orders are completed and the driver's disposal share is paid.
// reject: the orders go back to "collected, on board" and the driver must confirm the unload again.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(DISPOSAL_REVIEW_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'disposal_review', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderIds = body?.orderIds
  const decision = body?.decision
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''

  if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 60 || !orderIds.every(isUuid)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (decision !== 'approve' && decision !== 'reject') return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  if (decision === 'reject' && note.length < 3) {
    return NextResponse.json({ error: 'Please say why, so the driver knows what to fix' }, { status: 400 })
  }

  const ids: string[] = Array.from(new Set(orderIds))
  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, status: 'DISPOSAL_PENDING' },
    select: { id: true, status: true, driverId: true, quoteSnapshot: true, routeStop: { select: { routeId: true, tripNumber: true } } },
  })
  if (orders.length !== ids.length) {
    return NextResponse.json({ error: 'Some orders were already reviewed. Refresh the page.' }, { status: 409 })
  }
  const driverIds = new Set(orders.map((o) => o.driverId))
  if (driverIds.size !== 1 || !orders[0].driverId) {
    return NextResponse.json({ error: 'Review one driver’s trip at a time' }, { status: 400 })
  }
  const driverId = orders[0].driverId

  try {
    if (decision === 'approve') {
      const rule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
      if (!rule) return NextResponse.json({ error: 'No active payout rule' }, { status: 500 })

      // The site planned for this trip, if any.
      const stop = orders[0].routeStop
      const trip = stop
        ? await prisma.routeTrip.findUnique({ where: { routeId_tripNumber: { routeId: stop.routeId, tripNumber: stop.tripNumber } } })
        : null

      const paid = await prisma.$transaction(
        (tx) =>
          releaseDisposal(tx, {
            orders,
            fromStatus: 'DISPOSAL_PENDING',
            driverId,
            disposalPercent: rule.disposalPercent,
            facilityId: trip?.facilityId ?? null,
            method: 'ops_review',
            actorId: auth.user.id,
            reason: `Unload approved by ops after photo review${note ? `: ${note}` : ''}`,
          }),
        { timeout: 20000 }
      )
      await logAdminAction(auth.user.id, 'DISPOSAL_APPROVED', driverId, `${orders.length} order(s), GHS ${paid} released${note ? `: ${note}` : ''}`)
      return NextResponse.json({ success: true, paid })
    }

    await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: { in: ids }, status: 'DISPOSAL_PENDING' },
        data: { status: 'PICKED_UP' },
      })
      if (moved.count !== ids.length) throw new Error('STATE_CHANGED')
      await tx.auditLog.createMany({
        data: ids.map((orderId) => ({
          orderId,
          actorId: auth.user.id,
          fromState: 'DISPOSAL_PENDING',
          toState: 'PICKED_UP',
          reason: `Unload photo rejected by ops: ${note}. Driver must confirm the unload again.`,
        })),
      })
    })
    await logAdminAction(auth.user.id, 'DISPOSAL_REJECTED', driverId, `${orders.length} order(s): ${note}`)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ success: true, note: 'Already processed' })
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'Some orders were already reviewed. Refresh the page.' }, { status: 409 })
    }
    console.error('[disposal-review] failed:', e)
    return NextResponse.json({ error: 'Could not save the review. Please try again.' }, { status: 500 })
  }
}
