import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { orderId, photoPath } = await req.json()

  if (!photoPath) {
    return NextResponse.json({ error: 'Photo is required to confirm disposal' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'PICKED_UP') {
    return NextResponse.json({ error: 'Order not eligible for disposal confirmation' }, { status: 400 })
  }

  const idempotencyKey = `disposal-${orderId}`

  const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } })
  if (existing) {
    return NextResponse.json({ success: true, note: 'Already processed' })
  }

  const rule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!rule) {
    return NextResponse.json({ error: 'No active payout rule' }, { status: 500 })
  }

  const quote = order.quoteSnapshot as { price: number }
  const payoutAmount = (quote.price * rule.disposalPercent) / 100

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    }),
    prisma.orderEvidence.create({
      data: {
        orderId,
        type: 'driver_pickup', // reused type field; photoUrl path itself distinguishes "disposal-" vs "pickup-"
        photoUrl: photoPath,
        capturedAt: new Date(),
      },
    }),
    prisma.ledgerEntry.create({
      data: {
        orderId,
        type: 'driver_payout_disposal',
        amount: payoutAmount,
        idempotencyKey,
      },
    }),
    prisma.auditLog.create({
      data: {
        orderId,
        actorId: order.driverId,
        fromState: 'PICKED_UP',
        toState: 'COMPLETED',
        reason: 'Driver confirmed disposal with photo evidence',
      },
    }),
  ])

  return NextResponse.json({ success: true, payoutAmount })
}