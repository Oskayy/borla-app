import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { orderId } = await req.json()

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'ASSIGNED') {
    return NextResponse.json({ error: 'Order not eligible for pickup confirmation' }, { status: 400 })
  }

  const idempotencyKey = `pickup-${orderId}`

  // Idempotency check: if this payout already happened, don't do it again
  const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } })
  if (existing) {
    return NextResponse.json({ success: true, note: 'Already processed' })
  }

  const rule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!rule) {
    return NextResponse.json({ error: 'No active payout rule' }, { status: 500 })
  }

  const quote = order.quoteSnapshot as { price: number }
  const payoutAmount = (quote.price * rule.pickupPercent) / 100

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'PICKED_UP' },
    }),
    prisma.ledgerEntry.create({
      data: {
        orderId,
        type: 'driver_payout_pickup',
        amount: payoutAmount,
        idempotencyKey,
      },
    }),
    prisma.auditLog.create({
      data: {
        orderId,
        actorId: order.driverId,
        fromState: 'ASSIGNED',
        toState: 'PICKED_UP',
        reason: 'Driver confirmed pickup',
      },
    }),
  ])

  return NextResponse.json({ success: true, payoutAmount })
}