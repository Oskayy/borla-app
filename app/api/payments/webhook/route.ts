import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { isUuid } from '@/lib/validate'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking, describeCollection, formatClock, localParts } from '@/lib/shift'
import { refundStatusFromPaystack } from '@/lib/refunds'
import { markRefundProcessed } from '@/lib/refunds-server'
import { notifyOps, notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { freezeSplitAtPayment } from '@/lib/order-split-server'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    console.error('[webhook] PAYSTACK_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Confirm this really came from Paystack.
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Signed by Paystack but still checked field by field below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const name = typeof event?.event === 'string' ? event.event : ''
  try {
    if (name.startsWith('transfer.')) {
      await handleTransfer(name, event.data)
      return NextResponse.json({ received: true })
    }
    if (name.startsWith('refund.')) {
      await handleRefund(event.data)
      return NextResponse.json({ received: true })
    }
  } catch (e) {
    console.error(`[webhook] ${name} failed:`, e)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }) // Paystack will retry
  }

  if (name !== 'charge.success') {
    return NextResponse.json({ received: true })
  }

  const data = event.data
  const orderId = data?.metadata?.orderId
  const providerRef = data?.reference
  const paidPesewas = data?.amount

  if (
    !isUuid(orderId) ||
    typeof providerRef !== 'string' ||
    !Number.isInteger(paidPesewas) ||
    data?.status !== 'success' ||
    data?.currency !== 'GHS'
  ) {
    console.error('[webhook] Ignoring malformed charge.success event')
    return NextResponse.json({ received: true })
  }

  const amount = paidPesewas / 100

  // The shift is decided by when payment lands: before the planning snapshot -> tonight's planned batch,
  // snapshot to cutoff -> tonight as a late order, after the cutoff -> the next night.
  const settings = await getShiftSettings()
  const now = new Date()
  const booking = classifyBooking(now, settings)
  const shiftDate = new Date(`${booking.shiftDate}T00:00:00.000Z`)
  let paidCustomerId: string | null = null

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({ where: { providerRef } })
      if (existing) return // already processed

      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) {
        console.error('[webhook] Order not found for a successful payment:', orderId, providerRef)
        return
      }

      const quote = order.quoteSnapshot as { price?: number; platformFee?: number } | null
      const expectedPesewas = Math.round((quote?.price ?? -1) * 100)

      // Paid amount must match the order price exactly.
      if (paidPesewas !== expectedPesewas) {
        await tx.payment.create({
          data: { orderId, provider: 'paystack', amount, status: 'amount_mismatch', providerRef },
        })
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

      await tx.payment.create({
        data: { orderId, provider: 'paystack', amount, status: 'success', providerRef },
      })
      await tx.ledgerEntry.create({
        data: { orderId, type: 'customer_payment', amount, amountPesewas: paidPesewas, idempotencyKey: `payment-${providerRef}` },
      })

      // Only an unpaid order may become PAID.
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
        data: { status: 'PAID', shiftDate, isLateOrder: booking.isLate },
      })

      if (moved.count === 1) paidCustomerId = order.customerId

      // Freeze the split now (price, platform fee, pickup and unload shares), so later rule changes don't
      // touch this order. If no payout rule is active it is worked out at the first payout instead; the
      // payment is still recorded.
      if (moved.count === 1) {
        let platformFee: number | null = null
        try {
          platformFee = (await freezeSplitAtPayment(tx, orderId, paidPesewas, order.quoteSnapshot)).platformFee
        } catch (err) {
          if (caught(err)?.message !== 'NO_PAYOUT_RULE') throw err
          console.error('[webhook] No active payout rule: split not frozen at payment for', orderId)
        }
        // Trashit's platform fee, recorded once per order.
        if (platformFee && platformFee > 0) {
          await tx.ledgerEntry.create({
            data: { orderId, type: 'platform_fee', amount: platformFee / 100, amountPesewas: platformFee, idempotencyKey: `platform-fee-${orderId}` },
          })
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
              ? `Paystack webhook confirmed payment. Shift ${booking.shiftDate}${booking.isLate ? ' (late order)' : ''}`
              : 'DUPLICATE OR LATE PAYMENT received for an order that was not awaiting payment. Review for refund.',
        },
      })
    })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2002') return NextResponse.json({ received: true }) // duplicate delivery
    console.error('[webhook] Database transaction failed:', e)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }) // Paystack will retry
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

  return NextResponse.json({ received: true })
}

// Driver withdrawals: Paystack tells us whether the money reached the wallet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paystack event data, fields checked before use
async function handleTransfer(name: string, data: any) {
  const reference = data?.reference
  if (typeof reference !== 'string') return
  const w = await prisma.withdrawal.findUnique({ where: { reference } })
  if (!w || w.status === 'REJECTED' || w.status === 'FAILED') return
  const amountLabel = `GHS ${w.amount.toFixed(2)}`
  // A reversal can come after a success; anything else about a paid withdrawal is old news.
  if (w.status === 'PAID' && (name !== 'transfer.reversed' || w.method === 'manual')) return

  if (name === 'transfer.success') {
    await prisma.withdrawal.update({
      where: { id: w.id },
      data: { status: 'PAID', paidAt: new Date(), transferCode: data?.transfer_code ?? w.transferCode, note: null },
    })
    await notifyUser(w.driverId, {
      title: 'Earnings sent',
      body: `${amountLabel} was sent to your ${w.momoProvider} wallet ${w.momoNumber}.`,
      url: '/dashboard/driver/earnings',
      sms: `Trashit: ${amountLabel} has been sent to your MoMo wallet ${w.momoNumber}.`,
    })
  } else if (['transfer.failed', 'transfer.reversed', 'transfer.abandoned', 'transfer.rejected', 'transfer.blocked'].includes(name)) {
    // Failed money goes back into the driver's balance (FAILED withdrawals don't count against it).
    await prisma.withdrawal.update({
      where: { id: w.id },
      data: { status: 'FAILED', note: `Paystack: ${name === 'transfer.reversed' ? 'transfer reversed' : 'transfer failed'}${data?.reason ? ` (${String(data.reason).slice(0, 100)})` : ''}` },
    })
    await notifyUser(w.driverId, {
      title: 'Withdrawal failed',
      body: `We couldn't send ${amountLabel} to ${w.momoNumber}. The money is back in your Trashit balance. Please check your wallet details and try again.`,
      url: '/dashboard/driver/earnings',
    })
  }
}

// Customer refunds: Paystack reports progress until the money is back with the customer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paystack event data, fields checked before use
async function handleRefund(data: any) {
  const status = refundStatusFromPaystack(data?.status)
  const paystackId = data?.id != null ? String(data.id) : null
  let refund = paystackId ? await prisma.refund.findUnique({ where: { paystackRefundId: paystackId } }) : null
  if (!refund && typeof data?.transaction_reference === 'string') {
    // We don't know Paystack's id for it yet (e.g. the create call timed out). Match it only when that's unambiguous:
    // one open refund without an id on this payment, preferring the same amount.
    const payment = await prisma.payment.findUnique({ where: { providerRef: data.transaction_reference } })
    if (payment) {
      const open = await prisma.refund.findMany({
        where: { paymentId: payment.id, paystackRefundId: null, status: { in: ['PENDING', 'PROCESSING', 'NEEDS_ATTENTION'] } },
      })
      const pesewas = Number(data?.amount)
      const sameAmount = open.filter((r: { amount: number }) => Number.isFinite(pesewas) && Math.round(r.amount * 100) === pesewas)
      refund = sameAmount.length === 1 ? sameAmount[0] : open.length === 1 ? open[0] : null
      if (!refund && open.length > 1) {
        // Answer with an error so Paystack sends it again later, by when our side has saved Paystack's refund id.
        throw new Error(`refund event matches ${open.length} open refunds on ${data?.transaction_reference}`)
      }
    }
  }
  if (!refund || refund.status === 'PROCESSED' || refund.status === 'FAILED') return

  if (status === 'PROCESSED') {
    await markRefundProcessed(refund.id)
  } else {
    await prisma.refund.update({ where: { id: refund.id }, data: { status, paystackRefundId: refund.paystackRefundId ?? paystackId } })
    if (status === 'FAILED' || status === 'NEEDS_ATTENTION') {
      await notifyOps({
        title: status === 'FAILED' ? 'Refund failed' : 'Refund needs attention',
        body: `A refund of GHS ${refund.amount.toFixed(2)} ${status === 'FAILED' ? 'failed' : 'needs action in the Paystack dashboard'}. See the Exceptions page.`,
        url: '/ops/exceptions',
      })
    }
  }
}