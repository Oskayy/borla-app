import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { notifyCustomersCompleted } from '@/lib/customer-updates'
import { DISPOSAL_REVIEW_ROLES, releaseDisposal } from '@/lib/disposal-release'
import { getShiftSettings } from '@/lib/settings'
import { caught } from '@/lib/errors'
import { shiftEndsAt } from '@/lib/earnings'
import { REFUND_ROLES } from '@/lib/refunds'
import { refundOrder } from '@/lib/refunds-server'

// Ops decide on unloads that couldn't be checked automatically (photo outside the site's geofence, or no GPS).
// approve: the orders are completed and the driver's disposal share is paid.
// reject: the orders go back to "collected, on board" and the driver must confirm the unload again.
// Loads collected but never confirmed as unloaded (their night is over) can also be decided here:
// approve (the driver did unload: release their pay) or driver_fault (refund the customer in full and take back
// the pickup share; lib/earnings.ts).
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
  const neverUnloaded = body?.kind === 'never_unloaded'
  if (decision !== 'approve' && decision !== 'reject' && !(neverUnloaded && decision === 'driver_fault')) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }
  if (decision === 'driver_fault' && note.length < 3) {
    return NextResponse.json({ error: 'Please say what happened; it is kept on the order and shown on the refund' }, { status: 400 })
  }
  if (decision === 'driver_fault' && !REFUND_ROLES.includes(auth.dbUser.role)) {
    return NextResponse.json({ error: 'Only a Super Admin, Ops Manager or Finance can refund' }, { status: 403 })
  }
  if (decision === 'reject' && note.length < 3) {
    return NextResponse.json({ error: 'Please say why, so the driver knows what to fix' }, { status: 400 })
  }

  const ids: string[] = Array.from(new Set(orderIds))
  const settings = await getShiftSettings()
  const found = await prisma.order.findMany({
    where: { id: { in: ids }, status: neverUnloaded ? 'PICKED_UP' : 'DISPOSAL_PENDING' },
    select: { id: true, status: true, driverId: true, shiftDate: true, routeStop: { select: { routeId: true, tripNumber: true } } },
  })
  // Still on board: only once the night is over (until then the driver may still be on the way to the site).
  const now = Date.now()
  const orders = neverUnloaded ? found.filter((o) => (shiftEndsAt(o.shiftDate, settings)?.getTime() ?? Infinity) <= now) : found
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

      // The site planned for this trip, if any.
      const stop = orders[0].routeStop
      const trip = stop
        ? await prisma.routeTrip.findUnique({ where: { routeId_tripNumber: { routeId: stop.routeId, tripNumber: stop.tripNumber } } })
        : null

      const paid = await prisma.$transaction(
        (tx) =>
          releaseDisposal(tx, {
            orders,
            fromStatus: neverUnloaded ? 'PICKED_UP' : 'DISPOSAL_PENDING',
            driverId,
            settings,
            facilityId: trip?.facilityId ?? null,
            method: 'ops_review',
            actorId: auth.user.id,
            reason: neverUnloaded
              ? `Unload confirmed by ops after the night (driver did unload)${note ? `: ${note}` : ''}`
              : `Unload approved by ops after photo review${note ? `: ${note}` : ''}`,
          }),
        { timeout: 20000 }
      )
      await logAdminAction(auth.user.id, 'DISPOSAL_APPROVED', driverId, `${orders.length} order(s), GHS ${paid} released${note ? `: ${note}` : ''}`)
      await notifyCustomersCompleted(ids)
      return NextResponse.json({ success: true, paid })
    }

    if (neverUnloaded && decision === 'reject') {
      return NextResponse.json({ error: 'Choose whether the driver unloaded or was at fault' }, { status: 400 })
    }
    if (decision === 'driver_fault') {
      // Never unloaded and the driver is to blame: the customer gets everything back, the order is cancelled,
      // and the pickup share is taken back once the refund has gone through.
      const problems: string[] = []
      for (const o of orders) {
        const r = await refundOrder({
          orderId: o.id,
          amount: null,
          reason: `Collected but never unloaded (driver at fault): ${note}`,
          actorId: auth.user.id,
          cancel: true,
          staffApproval: true,
          driverFault: true,
        })
        if (!r.ok) problems.push(r.error)
      }
      await logAdminAction(auth.user.id, 'NEVER_UNLOADED_DRIVER_FAULT', driverId, `${orders.length} order(s): ${note}`)
      if (problems.length) return NextResponse.json({ error: `Some refunds didn't start: ${problems.join('; ')}` }, { status: 502 })
      return NextResponse.json({ success: true })
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
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2002') return NextResponse.json({ success: true, note: 'Already processed' })
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'Some orders were already reviewed. Refresh the page.' }, { status: 409 })
    }
    if (e?.message === 'BAD_PRICE' || e?.message === 'NO_PAYOUT_RULE') {
      console.error('[disposal-review] cannot work out the pay:', e.message)
      return NextResponse.json({ error: "An order on this trip has no price or there is no active payout rule. Check the Payouts page." }, { status: 409 })
    }
    console.error('[disposal-review] failed:', e)
    return NextResponse.json({ error: 'Could not save the review. Please try again.' }, { status: 500 })
  }
}
