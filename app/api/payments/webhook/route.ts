import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { isUuid } from '@/lib/validate'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking } from '@/lib/shift'

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

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (event?.event !== 'charge.success') {
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
  const booking = classifyBooking(new Date(), await getShiftSettings())
  const shiftDate = new Date(`${booking.shiftDate}T00:00:00.000Z`)

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
        data: { orderId, type: 'customer_payment', amount, idempotencyKey: `payment-${providerRef}` },
      })

      // Only an unpaid order may become PAID.
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
        data: { status: 'PAID', shiftDate, isLateOrder: booking.isLate },
      })

      // Borla's platform fee, recorded once per order.
      const platformFee = quote?.platformFee
      if (moved.count === 1 && typeof platformFee === 'number' && platformFee > 0) {
        await tx.ledgerEntry.create({
          data: { orderId, type: 'platform_fee', amount: platformFee, idempotencyKey: `platform-fee-${orderId}` },
        })
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
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ received: true }) // duplicate delivery
    console.error('[webhook] Database transaction failed:', e)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }) // Paystack will retry
  }

  return NextResponse.json({ received: true })
}