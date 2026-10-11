import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { getShiftSettings } from '@/lib/settings'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { cancelOrder, refundOrder } from '@/lib/refunds-server'
import { REFUND_ROLES } from '@/lib/refunds'
import { ensureSplit } from '@/lib/order-split-server'
import { attemptSplit } from '@/lib/money-split'
import { ATTEMPT_TYPE, clearsAt, shiftEndsAt } from '@/lib/earnings'
import { postJournal } from '@/lib/journal-server'
import { earnedLines, feeIncomeLines } from '@/lib/accounts'
import { notifyUser } from '@/lib/notify'
import { EXCEPTION_ROLES } from '@/lib/exceptions'
import { caught } from '@/lib/errors'

// Resolves a flagged order from the Exceptions page:
//   retry            -> back in the queue for tonight (or the coming night); a driver is assigned as usual
//   close            -> closed with no refund (e.g. the customer wasn't ready); the order is cancelled
//   attempt_fee      -> failed pickup that was the customer's fault: the driver is paid for the trip, the customer
//                       gets the rest back, the order is cancelled (lib/money-split.ts attemptSplit)
//   gps_reviewed     -> a GPS mismatch was checked and is fine
//   payment_reviewed -> a payment problem was dealt with (e.g. refunded) and can leave the list
// Refunds go through /api/admin/orders/[id]/refund.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(EXCEPTION_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'exception_action', maxAttempts: 100, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  const body = await readJson(req)
  const action = body?.action
  const note = cleanText(body?.note, 300)
  if (!note || note.length < 3) return NextResponse.json({ error: 'Please add a short note about what you decided' }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, customerId: true, driverId: true, quoteSnapshot: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const flagged = order.status === 'FAILED_PICKUP' || order.status === 'DISPUTED'

  if (action === 'gps_reviewed' || action === 'payment_reviewed') {
    const tag = action === 'gps_reviewed' ? 'GPS REVIEWED' : 'PAYMENT PROBLEM RESOLVED'
    await prisma.auditLog.create({ data: { orderId: id, actorId: auth.user.id, fromState: order.status, toState: order.status, reason: `${tag}: ${note}` } })
    await logAdminAction(auth.user.id, action === 'gps_reviewed' ? 'GPS_MISMATCH_REVIEWED' : 'PAYMENT_PROBLEM_RESOLVED', id, note)
    return NextResponse.json({ success: true })
  }

  if (!flagged) return NextResponse.json({ error: 'This order is no longer flagged. Please refresh.' }, { status: 409 })

  if (action === 'retry') {
    const settings = await getShiftSettings()
    const night = planningShiftDate(new Date(), settings)
    try {
      await prisma.$transaction(async (tx) => {
        const moved = await tx.order.updateMany({
          where: { id, status: { in: ['FAILED_PICKUP', 'DISPUTED'] } },
          data: {
            status: 'PAID',
            driverId: null,
            driverAcceptedAt: null,
            offeredAt: null,
            shiftDate: dbDate(night),
            isLateOrder: false,
            assignedNoticeAt: null,
          },
        })
        if (moved.count !== 1) throw new Error('STATE_CHANGED')
        await tx.routeStop.deleteMany({ where: { orderId: id } })
        await tx.dispute.updateMany({
          where: { orderId: id, status: 'OPEN' },
          data: { status: 'RESOLVED', resolution: `Retry: ${note}`, resolvedBy: auth.user.id, resolvedAt: new Date() },
        })
        await tx.auditLog.create({
          data: { orderId: id, actorId: auth.user.id, fromState: order.status, toState: 'PAID', reason: `EXCEPTION RESOLVED - retry on the night of ${night}: ${note}` },
        })
      })
    } catch (err) {
      const e = caught(err)
      if (e?.message === 'STATE_CHANGED') return NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 })
      throw err
    }
    await logAdminAction(auth.user.id, 'EXCEPTION_RETRY', id, note)
    await notifyUser(order.customerId, {
      title: 'We’ll collect again',
      body: 'We couldn’t complete your last pickup, so we’ve booked another try at no extra cost. Please make sure your bins are out and reachable.',
      url: `/dashboard/customer/orders/${id}`,
      sms: 'Trashit: we couldn’t complete your pickup, so we’ll try again at no extra cost. Please put your bins out where the driver can reach them.',
    })
    return NextResponse.json({ success: true, night })
  }

  if (action === 'attempt_fee') {
    if (order.status !== 'FAILED_PICKUP' || !order.driverId) {
      return NextResponse.json({ error: 'Only a failed pickup with a driver can be charged an attempt fee' }, { status: 409 })
    }
    if (!REFUND_ROLES.includes(auth.dbUser.role)) {
      return NextResponse.json({ error: 'Only a Super Admin, Ops Manager or Finance can refund' }, { status: 403 })
    }
    const settings = await getShiftSettings()
    const full = await prisma.order.findUnique({ where: { id }, select: { shiftDate: true } })
    const driverId = order.driverId
    let split: ReturnType<typeof attemptSplit>
    try {
      split = await prisma.$transaction(async (tx) => {
        const frozen = await ensureSplit(tx, id)
        const s = attemptSplit(frozen.price, frozen.feeBps)
        // The driver's pay for the wasted trip: clears like any other earnings for that night.
        if (s.driverShare > 0) {
          await tx.ledgerEntry.create({
            data: {
              orderId: id,
              type: ATTEMPT_TYPE,
              amount: s.driverShare / 100,
              amountPesewas: s.driverShare,
              driverId,
              idempotencyKey: `attempt-${id}`,
              clearsAt: clearsAt(new Date(), shiftEndsAt(full?.shiftDate ?? null, settings)),
            },
          })
        }
        await postJournal(tx, {
          key: `attempt-${id}`,
          event: 'attempt',
          orderId: id,
          driverId,
          lines: [...earnedLines(id, driverId, s.driverShare), ...feeIncomeLines(id, s.platformShare)],
        })
        await tx.auditLog.create({
          data: {
            orderId: id,
            actorId: auth.user.id,
            fromState: order.status,
            toState: order.status,
            reason: `ATTEMPT FEE: customer's fault. Driver paid GHS ${(s.driverShare / 100).toFixed(2)}, refund GHS ${(s.refund / 100).toFixed(2)}: ${note}`,
          },
        })
        return s
      })
    } catch (err) {
      const e = caught(err)
      if (e?.code === 'P2002') return NextResponse.json({ error: 'The attempt fee was already charged on this order' }, { status: 409 })
      if (e?.message === 'BAD_PRICE' || e?.message === 'NO_PAYOUT_RULE') {
        return NextResponse.json({ error: 'This order has no price or there is no active payout rule.' }, { status: 409 })
      }
      throw err
    }

    const refund = await refundOrder({
      orderId: id,
      amount: split.refund / 100,
      reason: `Failed pickup (customer's side), attempt fee kept: ${note}`,
      actorId: auth.user.id,
      cancel: true,
      staffApproval: true,
    })
    await prisma.dispute.updateMany({
      where: { orderId: id, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution: `Attempt fee: ${note}`, resolvedBy: auth.user.id, resolvedAt: new Date() },
    })
    await logAdminAction(auth.user.id, 'EXCEPTION_ATTEMPT_FEE', id, `driver GHS ${(split.driverShare / 100).toFixed(2)}, refund GHS ${(split.refund / 100).toFixed(2)}: ${note}`)
    await notifyUser(driverId, {
      title: 'Paid for a wasted trip',
      body: `GHS ${(split.driverShare / 100).toFixed(2)} for a pickup you couldn't collect because of the customer. It clears with the rest of that night's pay.`,
      url: '/dashboard/driver/earnings',
    })
    if (!refund.ok) return NextResponse.json({ error: `The driver was paid, but the refund didn't start: ${refund.error}` }, { status: 502 })
    return NextResponse.json({
      success: true,
      driverShare: split.driverShare / 100,
      refund: split.refund / 100,
      awaitingApproval: refund.awaitingApproval ?? null,
    })
  }

  if (action === 'close') {
    await prisma.dispute.updateMany({
      where: { orderId: id, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution: `Closed: ${note}`, resolvedBy: auth.user.id, resolvedAt: new Date() },
    })
    await cancelOrder(id, auth.user.id, `Closed by ops without refund: ${note}`)
    await logAdminAction(auth.user.id, 'EXCEPTION_CLOSED', id, note)
    await notifyUser(order.customerId, {
      title: 'Pickup closed',
      body: `Your pickup was closed: ${note}. If you think this is wrong, please contact Trashit support.`,
      url: `/dashboard/customer/orders/${id}`,
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
