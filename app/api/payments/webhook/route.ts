import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'


export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify this request genuinely came from Paystack, not an impostor
  const signature = req.headers.get('x-paystack-signature')
  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex')

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'charge.success') {
    const orderId = event.data.metadata.orderId
    const providerRef = event.data.reference
    const amount = event.data.amount / 100 // back to GHS from pesewas

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) return

      // Idempotency: if we've already recorded this exact payment reference, stop here
      const existing = await tx.payment.findUnique({ where: { providerRef } })
      if (existing) return

      await tx.payment.create({
        data: {
          orderId,
          provider: 'paystack',
          amount,
          status: 'success',
          providerRef,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          orderId,
          type: 'customer_payment',
          amount,
          idempotencyKey: `payment-${providerRef}`,
        },
      })

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
      })

      await tx.auditLog.create({
        data: {
          orderId,
          actorId: null,
          fromState: order.status,
          toState: 'PAID',
          reason: 'Paystack webhook confirmed payment',
        },
      })
    })
  }

  return NextResponse.json({ received: true })
}