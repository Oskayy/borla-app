import { prisma } from '@/lib/prisma'
import { createRefund } from '@/lib/paystack'
import { LIVE_REFUND_STATUSES, needsSecondApprover, REFUND_APPROVAL_THRESHOLD_GHS, REFUND_ROLES, refundable, refundStatusFromPaystack } from '@/lib/refunds'
import { notifyUser, notifyUsers } from '@/lib/notify'
import { caught } from '@/lib/errors'

export interface RefundOutcome {
  ok: boolean
  error: string
  refunded: number
  awaitingApproval?: number // a large staff refund of this amount is held until a second person approves it
}

// Refunds money for an order through Paystack. `amount` null = everything still refundable.
// If `cancel` is true the order is also cancelled (taken off any driver's list).
export async function refundOrder(args: {
  orderId: string
  amount: number | null
  reason: string
  actorId: string
  cancel: boolean
  paymentId?: string // a specific payment (e.g. a duplicate payment); default: the order's successful payment
  staffApproval?: boolean // a staff refund: at or above REFUND_APPROVAL_THRESHOLD_GHS it waits for a second approver
}): Promise<RefundOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      status: true,
      customerId: true,
      driverId: true,
      quoteSnapshot: true,
      payments: { select: { id: true, amount: true, status: true, providerRef: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!order) return { ok: false, error: 'Order not found', refunded: 0 }

  const payment = args.paymentId
    ? order.payments.find((p: { id: string }) => p.id === args.paymentId)
    : order.payments.find((p: { status: string }) => p.status === 'success' || p.status === 'partially_refunded')
  if (!payment) return { ok: false, error: 'No payment to refund on this order', refunded: 0 }

  // Work out what's left and record the refund (holding the amount) in one serializable step,
  // so two refunds at the same moment (e.g. a double tap) can't both take the full amount.
  let refund: { id: string; amount: number; status: string }
  try {
    refund = await prisma.$transaction(
      async (tx) => {
        const live = await tx.refund.findMany({
          where: { paymentId: payment.id, status: { in: LIVE_REFUND_STATUSES } },
          select: { amount: true },
        })
        const available = refundable(payment.amount, live.map((r: { amount: number }) => r.amount))
        const amount = args.amount == null ? available : Math.round(args.amount * 100) / 100
        if (amount <= 0) throw new Error('NOTHING_LEFT')
        if (amount > available) throw new Error(`TOO_MUCH:${available.toFixed(2)}`)
        const status = args.staffApproval === true && needsSecondApprover(amount) ? 'AWAITING_APPROVAL' : 'PENDING'
        return tx.refund.create({
          data: { orderId: order.id, paymentId: payment.id, amount, reason: args.reason, requestedBy: args.actorId, cancelOrder: args.cancel, status },
          select: { id: true, amount: true, status: true },
        })
      },
      { isolationLevel: 'Serializable', timeout: 15000 }
    )
  } catch (err) {
    const e = caught(err)
    if (e?.message === 'NOTHING_LEFT') return { ok: false, error: 'Nothing left to refund on this payment', refunded: 0 }
    if (typeof e?.message === 'string' && e.message.startsWith('TOO_MUCH:')) {
      return { ok: false, error: `At most GHS ${e.message.slice(9)} can be refunded`, refunded: 0 }
    }
    if (e?.code === 'P2034') return { ok: false, error: 'Another refund is being made on this order. Please refresh and try again.', refunded: 0 }
    throw err
  }
  const amount = refund.amount

  if (refund.status === 'AWAITING_APPROVAL') {
    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        actorId: args.actorId,
        fromState: order.status,
        toState: order.status,
        reason: `REFUND of GHS ${amount.toFixed(2)} waiting for a second approver${args.cancel ? ' (then cancel)' : ''}: ${args.reason}`,
      },
    })
    const others = await prisma.user.findMany({
      where: { role: { in: REFUND_ROLES }, active: true, id: { not: args.actorId } },
      select: { id: true },
    })
    await notifyUsers(
      others.map((s: { id: string }) => s.id),
      {
        title: 'Refund to approve',
        body: `A refund of GHS ${amount.toFixed(2)} (GHS ${REFUND_APPROVAL_THRESHOLD_GHS} or more) needs a second approver.`,
        url: '/ops/exceptions',
      }
    )
    return { ok: true, error: '', refunded: 0, awaitingApproval: amount }
  }

  return sendRefund({ refund, amount, payment, order, args })
}

// Sends a recorded (PENDING) refund to Paystack; then cancels the order if asked and tells the customer.
async function sendRefund(p: {
  refund: { id: string }
  amount: number
  payment: { providerRef: string }
  order: { id: string; status: string; customerId: string }
  args: { reason: string; actorId: string; cancel: boolean }
}): Promise<RefundOutcome> {
  const { refund, amount, payment, order, args } = p

  const r = await createRefund({
    transaction: payment.providerRef,
    amountGhs: amount,
    merchantNote: `Trashit order ${order.id}: ${args.reason}`,
    customerNote: 'Refund from Trashit',
  })
  if (!r.ok && !r.uncertain) {
    // Paystack clearly refused: nothing was sent, so the amount is released.
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED', reason: `${args.reason} [Paystack: ${r.error}]` } })
    return { ok: false, error: `Paystack could not start the refund: ${r.error}`, refunded: 0 }
  }
  if (!r.ok) {
    // No clear answer (timeout): it may have gone through. Keep the amount held and let Paystack's webhook settle it.
    await prisma.refund.updateMany({
      where: { id: refund.id, status: 'PENDING' },
      data: { status: 'NEEDS_ATTENTION', reason: `${args.reason} [no answer from Paystack; check the Paystack dashboard]` },
    })
  } else {
    // A fast webhook may already have moved this refund on, so only a still-PENDING row takes this status.
    if (r.data?.id != null) {
      await prisma.refund.updateMany({ where: { id: refund.id, paystackRefundId: null }, data: { paystackRefundId: String(r.data.id) } })
    }
    const status = refundStatusFromPaystack(r.data?.status)
    if (status === 'PROCESSED') await markRefundProcessed(refund.id)
    else if (status !== 'PENDING') await prisma.refund.updateMany({ where: { id: refund.id, status: 'PENDING' }, data: { status } })
    if (status === 'FAILED') {
      // Refused on the spot: nothing is on its way, so don't cancel or tell the customer it is.
      return { ok: false, error: 'Paystack refused the refund. Check the payment in the Paystack dashboard.', refunded: 0 }
    }
  }

  if (args.cancel) await cancelOrder(order.id, args.actorId, args.reason)

  await prisma.auditLog.create({
    data: {
      orderId: order.id,
      actorId: args.actorId,
      fromState: order.status,
      toState: args.cancel ? 'CANCELLED' : order.status,
      reason: `REFUND of GHS ${amount.toFixed(2)} started: ${args.reason}`,
    },
  })
  await notifyUser(order.customerId, {
    title: 'Refund on its way',
    body: `We've started a refund of GHS ${amount.toFixed(2)} to the account you paid with. It usually arrives within a few working days.`,
    url: `/dashboard/customer/orders/${order.id}`,
    sms: `Trashit: a refund of GHS ${amount.toFixed(2)} is on its way to the account you paid with.`,
  })
  return { ok: true, error: '', refunded: amount }
}

// A second staff member approves a large refund: it is sent to Paystack now (and the order cancelled if
// that was asked). The person who asked for the refund can't approve it.
export async function approveRefund(refundId: string, approverId: string): Promise<RefundOutcome> {
  const r = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      amount: true,
      status: true,
      reason: true,
      requestedBy: true,
      cancelOrder: true,
      payment: { select: { providerRef: true } },
      order: { select: { id: true, status: true, customerId: true } },
    },
  })
  if (!r) return { ok: false, error: 'Refund not found', refunded: 0 }
  if (r.status !== 'AWAITING_APPROVAL') return { ok: false, error: 'This refund is not waiting for approval', refunded: 0 }
  if (r.requestedBy === approverId) return { ok: false, error: 'A different staff member must approve a refund you asked for', refunded: 0 }

  const claimed = await prisma.refund.updateMany({
    where: { id: refundId, status: 'AWAITING_APPROVAL', requestedBy: { not: approverId } },
    data: { status: 'PENDING', approvedBy: approverId, approvedAt: new Date() },
  })
  if (claimed.count !== 1) return { ok: false, error: 'This refund was just updated. Please refresh.', refunded: 0 }

  return sendRefund({
    refund: { id: r.id },
    amount: r.amount,
    payment: r.payment,
    order: r.order,
    args: { reason: r.reason, actorId: approverId, cancel: r.cancelOrder },
  })
}

// Turns down a large refund that is waiting for approval: nothing is sent and the amount is released.
export async function declineRefund(refundId: string, actorId: string, note: string): Promise<RefundOutcome> {
  const r = await prisma.refund.findUnique({ where: { id: refundId }, select: { orderId: true, amount: true, reason: true, status: true, order: { select: { status: true } } } })
  if (!r) return { ok: false, error: 'Refund not found', refunded: 0 }
  const moved = await prisma.refund.updateMany({
    where: { id: refundId, status: 'AWAITING_APPROVAL' },
    data: { status: 'FAILED', reason: `${r.reason} [not approved: ${note}]`, approvedBy: actorId, approvedAt: new Date() },
  })
  if (moved.count !== 1) return { ok: false, error: 'This refund is not waiting for approval', refunded: 0 }
  await prisma.auditLog.create({
    data: { orderId: r.orderId, actorId, fromState: r.order.status, toState: r.order.status, reason: `REFUND of GHS ${r.amount.toFixed(2)} not approved: ${note}` },
  })
  return { ok: true, error: '', refunded: 0 }
}

// Takes an order out of service: off any driver's route, status CANCELLED.
export async function cancelOrder(orderId: string, actorId: string, reason: string): Promise<void> {
  const before = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, driverId: true, quoteSnapshot: true } })
  if (!before || before.status === 'CANCELLED' || before.status === 'COMPLETED') return
  let cancelled = false
  await prisma.$transaction(async (tx) => {
    // Only if nothing moved it on in the meantime (e.g. a driver collecting it during a refund call).
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: before.status },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.slice(0, 200), driverAcceptedAt: null, offeredAt: null },
    })
    if (moved.count !== 1) {
      await tx.auditLog.create({
        data: { orderId, actorId, fromState: before.status, toState: before.status, reason: `CANCEL SKIPPED: the order changed while cancelling (${reason}). Check it.` },
      })
      return
    }
    cancelled = true
    await tx.routeStop.deleteMany({ where: { orderId } })
    await tx.auditLog.create({ data: { orderId, actorId, fromState: before.status, toState: 'CANCELLED', reason: `CANCELLED: ${reason}` } })
  })
  if (!cancelled) return
  // A driver who had this stop is told it's gone.
  if (before.driverId && (before.status === 'ASSIGNED' || before.status === 'FAILED_PICKUP' || before.status === 'DISPUTED')) {
    const address = (before.quoteSnapshot as { address?: string } | null)?.address ?? 'A stop'
    await notifyUser(before.driverId, { title: 'Stop cancelled', body: `${address} was cancelled. You don't need to go there.`, url: '/dashboard/driver' })
  }
}

// Paystack confirmed the money went back: update the payment and the ledger (once).
export async function markRefundProcessed(refundId: string): Promise<void> {
  const refund = await prisma.refund.findUnique({ where: { id: refundId } })
  if (!refund) return
  try {
    await prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.create({
        data: { orderId: refund.orderId, type: 'refund', amount: refund.amount, idempotencyKey: `refund-${refund.id}` },
      })
      const p = await tx.payment.update({ where: { id: refund.paymentId }, data: { refundedAmount: { increment: refund.amount } } })
      await tx.payment.update({
        where: { id: p.id },
        data: { status: Math.round(p.refundedAmount * 100) >= Math.round(p.amount * 100) ? 'refunded' : 'partially_refunded' },
      })
      await tx.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSED' } })
    })
  } catch (err) {
    const e = caught(err)
    if (e?.code !== 'P2002') throw err
    // Already in the ledger: make sure the refund row says so too.
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSED' } })
  }
}
