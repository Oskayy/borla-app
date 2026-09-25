import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from '@/lib/geo'

export async function POST(req: NextRequest) {
  const { orderId, photoPath, gpsLat, gpsLng } = await req.json()

  if (!photoPath) {
    return NextResponse.json({ error: 'Photo is required to confirm pickup' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'ASSIGNED') {
    return NextResponse.json({ error: 'Order not eligible for pickup confirmation' }, { status: 400 })
  }

  const idempotencyKey = `pickup-${orderId}`

  const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } })
  if (existing) {
    return NextResponse.json({ success: true, note: 'Already processed' })
  }

  const rule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!rule) {
    return NextResponse.json({ error: 'No active payout rule' }, { status: 500 })
  }

  // Geofence check: is the driver's photo GPS near the order's address?
  let flagged = false
  let distanceMeters: number | null = null

  if (gpsLat != null && gpsLng != null && order.latitude != null && order.longitude != null) {
    distanceMeters = distanceInMeters(order.latitude, order.longitude, gpsLat, gpsLng)
    flagged = distanceMeters > GEOFENCE_THRESHOLD_METERS
  }

  const quote = order.quoteSnapshot as { price: number }
  const payoutAmount = (quote.price * rule.pickupPercent) / 100

  const auditReason = flagged
    ? `Driver confirmed pickup with photo evidence (GPS MISMATCH: photo taken ~${Math.round(
        distanceMeters as number
      )}m from pickup address)`
    : 'Driver confirmed pickup with photo evidence'

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'PICKED_UP' },
    }),
    prisma.orderEvidence.create({
      data: {
        orderId,
        type: 'driver_pickup',
        photoUrl: photoPath,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        capturedAt: new Date(),
      },
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
        reason: auditReason,
      },
    }),
  ])

  return NextResponse.json({ success: true, payoutAmount, flagged, distanceMeters })
}