import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { orderId, issueType, note, photoPath, gpsLat, gpsLng } = await req.json()

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'ASSIGNED') {
    return NextResponse.json({ error: 'Order not eligible for issue reporting' }, { status: 400 })
  }

  const newStatus = issueType === 'LOCKED_GATE' ? 'FAILED_PICKUP' : 'DISPUTED'

  await prisma.$transaction(async (tx) => {
    if (photoPath) {
      await tx.orderEvidence.create({
        data: {
          orderId,
          type: 'driver_pickup',
          photoUrl: photoPath,
          gpsLat: gpsLat ?? null,
          gpsLng: gpsLng ?? null,
          capturedAt: new Date(),
        },
      })
    }

    if (newStatus === 'DISPUTED') {
      await tx.dispute.create({
        data: {
          orderId,
          raisedBy: order.driverId ?? 'unknown',
          reason: `${issueType}: ${note || 'No additional note'}`,
        },
      })
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    })

    await tx.auditLog.create({
      data: {
        orderId,
        actorId: order.driverId,
        fromState: 'ASSIGNED',
        toState: newStatus,
        reason: `Driver reported: ${issueType} — ${note || 'no note'}`,
      },
    })
  })

  return NextResponse.json({ success: true, status: newStatus })
}