// Confirming a customer's payment. Two ways in, one set of rules:
//  - Paystack's signed webhook (charge.success), the usual way;
//  - asking Paystack directly (Verify Transaction) with our own checkout reference: when the customer comes back from
//    the checkout, and every few minutes for checkouts whose webhook hasn't arrived (Paystack's guidance: verify
//    before giving value, and don't give it twice when you also use webhooks).
// Both run confirmCharge, which records the payment once (the Payment row's providerRef and the journal keys are
// unique), so a webhook and a check arriving together can't mark an order paid twice.

import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking, describeCollection, formatClock, localParts } from '@/lib/shift'
import { notifyOps, notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { freezeSplitAtPayment } from '@/lib/order-split-server'
import { postJournal } from '@/lib/journal-server'
import { estimatePaymentFee, paymentFeeLines, paymentLines } from '@/lib/accounts'
import { snapshotTax } from '@/lib/tax'
import { isUuid } from '@/lib/validate'
import { verifyTransaction } from '@/lib/paystack'

export const CHECKOUT_REUSE_MINUTES = 30 // the same checkout page is sent again within this time (a double tap, a retry)
export const CHECKOUT_LOCK_HOURS = 24 // a draft can't be deleted while a checkout this recent may still be paid
const CHECK_AFTER_MS = 2 * 60_000 // give the webhook a couple of minutes before asking Paystack
const CHECK_EVERY_MS = 10 * 60_000 // then ask at most every 10 minutes per checkout
const CHECKS_PER_RUN = 20

export type ChargeOutcome = 'paid' | 'already' | 'mismatch' | 'late' | 'no_order' | 'ignored'

// Paystack's description of a successful charge (webhook event data, or the verify answer).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paystack data, every field checked before use
export async function confirmCharge(data: any, via: 'webhook' | 'verify'): Promise<ChargeOutcome> {
  const orderId = data?.metadata?.orderId
  const providerRef = data?.reference
  const paidPesewas = data?.amount
  if (!isUuid(orderId) || typeof providerRef !== 'string' || !Number.isInteger(paidPesewas) || data?.status !== 'success' || data?.currency !== 'GHS') {
    console.error('[payment] Ignoring a malformed successful charge', via)
    return 'ignored'
  }

  const amount = paidPesewas / 100
  // Paystack's fee on this payment (pesewas), if it says; otherwise estimated (and marked as such).
  const reportedFee = Number.isInteger(data?.fees) && data.fees >= 0 ? (data.fees as number) : null
  const fee = reportedFee ?? estimatePaymentFee(paidPesewas)

  // The shift is decided by when payment lands: before the planning snapshot -> tonight's planned batch,
  // snapshot to cutoff -> tonight as a late order, after the cutoff -> the next night.
  const settings = await getShiftSettings()
  const now = new Date()
  const booking = classifyBooking(now, settings)
  const shiftDate = new Date(`${booking.shiftDate}T00:00:00.000Z`)
  let outcome: ChargeOutcome = 'already'
  let paidCustomerId: string | null = null

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({ where: { providerRef } })
      if (existing) return // already recorded

      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) {
        outcome = 'no_order'
        return
      }

      const quote = order.quoteSnapshot as { price?: number } | null
      const expectedPesewas = Math.round((quote?.price ?? -1) * 100)

      // The money arrived whatever happens next: it is held for this order until the job is done or it is refunded.
      // Tax in a correctly paid price is owed to the tax office (an unexpected amount is all held until reviewed).
      const tax = paidPesewas === expectedPesewas ? snapshotTax(order.quoteSnapshot) : 0
      await postJournal(tx, { key: `payment-${providerRef}`, event: 'payment', orderId, lines: paymentLines(orderId, paidPesewas, tax) })
      await postJournal(tx, {
        key: `payment-fee-${providerRef}`,
        event: 'payment_fee',
        orderId,
        lines: paymentFeeLines(orderId, fee),
        memo: reportedFee === null ? 'Paystack fee estimated at 1.95% (not in the payment details)' : null,
      })

      // Paid amount must match the order price exactly.
      if (paidPesewas !== expectedPesewas) {
        outcome = 'mismatch'
        await tx.payment.create({ data: { orderId, provider: 'paystack', amount, status: 'amount_mismatch', providerRef } })
        await tx.auditLog.create({
          data: {
            orderId,
            actorId: null,
            fromState: order.status,
            toState: order.status,
            reason: `PAYMENT AMOUNT MISMATCH: paid GHS ${amount}, order price GHS ${quote?.price}. Needs manual review.`,
          },
        })
        return
      }

      await tx.payment.create({ data: { orderId, provider: 'paystack', amount, status: 'success', providerRef } })
      await tx.ledgerEntry.create({
        data: { orderId, type: 'customer_payment', amount, amountPesewas: paidPesewas, idempotencyKey: `payment-${providerRef}` },
      })

      // Only an unpaid order may become PAID.
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: 'DRAFT' },
        data: { status: 'PAID', shiftDate, isLateOrder: booking.isLate },
      })
      outcome = moved.count === 1 ? 'paid' : 'late'
      if (moved.count === 1) paidCustomerId = order.customerId

      // Freeze the split now (price, platform fee, pickup and unload shares), so later rule changes don't
      // touch this order. If no payout rule is active it is worked out at the first payout instead; the
      // payment is still recorded. The platform fee only becomes income when the job is finished.
      if (moved.count === 1) {
        try {
          await freezeSplitAtPayment(tx, orderId, paidPesewas, order.quoteSnapshot)
        } catch (err) {
          if (caught(err)?.message !== 'NO_PAYOUT_RULE') throw err
          console.error('[payment] No active payout rule: split not frozen at payment for', orderId)
        }
      }

      await tx.auditLog.create({
        data: {
          orderId,
          actorId: null,
          fromState: order.status,
          toState: moved.count === 1 ? 'PAID' : order.status,
          reason:
            moved.count === 1
              ? `${via === 'webhook' ? 'Paystack webhook' : 'Paystack check (verify)'} confirmed payment. Shift ${booking.shiftDate}${booking.isLate ? ' (late order)' : ''}`
              : 'DUPLICATE OR LATE PAYMENT received for an order that was not awaiting payment. Review for refund.',
        },
      })
    })
  } catch (err) {
    if (caught(err)?.code === 'P2002') return 'already' // recorded at the same moment by the other way in
    throw err
  }

  if ((outcome as ChargeOutcome) === 'no_order') {
    // The booking was deleted (or never existed) but the money arrived: ops refund it from the Paystack dashboard.
    // The 7am reconciliation also lists it as "at Paystack but not in the app".
    console.error('[payment] Successful payment for a missing order:', orderId, providerRef)
    await notifyOps({
      title: 'Payment for a booking that no longer exists',
      body: `GHS ${amount.toFixed(2)} arrived (Paystack reference ${providerRef}) for a booking that was deleted. Refund it from the Paystack dashboard.`,
      url: '/ops/finance',
    })
  }

  if (paidCustomerId) {
    const described = describeCollection(booking.shiftDate, localParts(now, settings.timezone).date, settings)
    const when = described.charAt(0).toLowerCase() + described.slice(1)
    const start = formatClock(settings.shiftStartMinutes)
    await notifyUser(paidCustomerId, {
      title: 'Payment received',
      body: `Thank you. Your pickup is booked for ${when}. Please put your bins out before the collection starts.`,
      url: `/dashboard/customer/orders/${orderId}`,
      sms: `Trashit: payment of GHS ${amount.toFixed(2)} received. Your pickup is ${when}. Please put your bins out by ${start}.`,
    })
  }
  return outcome
}

export type CheckoutState = 'paid' | 'pending' | 'abandoned' | 'not_found' | 'uncertain' | 'none'

// Asks Paystack about an order's checkout and records the payment if it went through.
export async function checkCheckout(orderId: string): Promise<CheckoutState> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, paystackReference: true } })
  if (!order?.paystackReference) return 'none'
  if (order.status !== 'DRAFT') return 'paid'
  const r = await verifyTransaction(order.paystackReference)
  await prisma.order.update({ where: { id: orderId }, data: { paymentCheckedAt: new Date() } })
  if (r.notFound) return 'not_found'
  if (!r.ok) return 'uncertain'
  const status = r.data?.status
  if (status === 'success') {
    if (r.data?.reference !== order.paystackReference || r.data?.metadata?.orderId !== orderId) {
      console.error('[payment] Paystack check returned a different payment for', orderId)
      return 'uncertain'
    }
    const outcome = await confirmCharge(r.data, 'verify')
    return outcome === 'paid' || outcome === 'already' || outcome === 'late' ? 'paid' : 'uncertain'
  }
  return status === 'abandoned' || status === 'failed' || status === 'reversed' ? 'abandoned' : 'pending'
}

// Every scheduled run: checkouts started in the last day whose payment hasn't been confirmed yet.
export async function checkRecentCheckouts(now: Date): Promise<number> {
  const due = await prisma.order.findMany({
    where: {
      status: 'DRAFT',
      paystackReference: { not: null },
      checkoutStartedAt: { gte: new Date(now.getTime() - CHECKOUT_LOCK_HOURS * 3600_000), lte: new Date(now.getTime() - CHECK_AFTER_MS) },
      OR: [{ paymentCheckedAt: null }, { paymentCheckedAt: { lte: new Date(now.getTime() - CHECK_EVERY_MS) } }],
    },
    orderBy: { checkoutStartedAt: 'desc' },
    take: CHECKS_PER_RUN,
    select: { id: true },
  })
  let paid = 0
  for (const o of due) {
    try {
      if ((await checkCheckout(o.id)) === 'paid') paid++
    } catch (err) {
      console.error('[payment] checkout check failed', o.id, caught(err))
    }
  }
  if (paid > 0) console.warn(`[payment] ${paid} payment(s) confirmed by asking Paystack (their webhook hadn't arrived)`)
  return paid
}

// Whether a draft may be deleted: never while a recent checkout could still be paid. Asks Paystack when it can't tell.
export async function draftDeletable(orderId: string, checkoutStartedAt: Date | null, now: Date): Promise<{ ok: boolean; error: string }> {
  if (!checkoutStartedAt || now.getTime() - checkoutStartedAt.getTime() > CHECKOUT_LOCK_HOURS * 3600_000) return { ok: true, error: '' }
  const state = await checkCheckout(orderId)
  if (state === 'paid') return { ok: false, error: 'This booking has just been paid, so it can’t be deleted. Refresh to see it.' }
  if (state === 'abandoned' || state === 'not_found' || state === 'none') return { ok: true, error: '' }
  return { ok: false, error: 'A payment for this booking may still be going through. Please try again in a few minutes.' }
}
