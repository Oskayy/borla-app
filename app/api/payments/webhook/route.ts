import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  console.log('[webhook] Received a call. PAYSTACK_SECRET_KEY present:', !!process.env.PAYSTACK_SECRET_KEY)

  const signature = req.headers.get('x-paystack-signature')
  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex')

  if (signature !== expectedSignature) {
    console.error('[webhook] Signature mismatch. Received:', signature, 'Expected:', expectedSignature)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  console.log('[webhook] Signature verified successfully.')

  const event = JSON.parse(rawBody)
  console.log('[webhook] Event type:', event.event)

  if (event.event === 'charge.success') {
    const orderId = event.data.metadata.orderId
    const providerRef = event.data.reference
    const amount = event.data.amount / 100

    console.log('[webhook] Processing charge.success for order:', orderId, 'ref:', providerRef)

    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId } })
        if (!order) {
          console.error('[webhook] Order not found:', orderId)
          return
        }

        const existing = await tx.payment.findUnique({ where: { providerRef } })
        if (existing) {
          console.log('[webhook] Payment already recorded, skipping (idempotent):', providerRef)
          return
        }

        await tx.payment.create({
          data: { orderId, provider: 'paystack', amount, status: 'success', providerRef },
        })

        await tx.ledgerEntry.create({
          data: { orderId, type: 'customer_payment', amount, idempotencyKey: `payment-${providerRef}` },
        })

        await tx.order.update({ where: { id: orderId }, data: { status: 'PAID' } })

        await tx.auditLog.create({
          data: {
            orderId,
            actorId: null,
            fromState: order.status,
            toState: 'PAID',
            reason: 'Paystack webhook confirmed payment',
          },
        })

        console.log('[webhook] Successfully marked order PAID:', orderId)
      })
    } catch (e) {
      console.error('[webhook] Database transaction failed:', e)
    }
  }

  return NextResponse.json({ received: true })
}