import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { orderId, driverId } = await req.json()

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'PAID') {
    return NextResponse.json({ error: 'Order not eligible for assignment' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { driverId, status: 'ASSIGNED' },
    }),
    prisma.auditLog.create({
      data: {
        orderId,
        actorId: null,
        fromState: 'PAID',
        toState: 'ASSIGNED',
        reason: 'Manually assigned via ops screen',
      },
    }),
  ])

  return NextResponse.json({ success: true })
}