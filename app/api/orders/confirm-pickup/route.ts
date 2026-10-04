import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'
import { driverPoolFromSnapshot } from '@/lib/pricing-core'
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from '@/lib/geo'
import { notifyCustomerCollected } from '@/lib/customer-updates'
import { caught } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'confirm_pickup', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  const photoPath = body?.photoPath
  const gps = parseGps(body)

  if (!isUuid(orderId) || !gps.ok) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!isValidEvidencePath(photoPath, orderId)) {
    return NextResponse.json({ error: 'A valid photo is required to confirm pickup' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.driverId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'ASSIGNED') {
    return NextResponse.json({ error: 'Order not eligible for pickup confirmation' }, { status: 400 })
  }
  if (!order.driverAcceptedAt) {
    return NextResponse.json({ error: 'Please accept this stop first' }, { status: 409 })
  }

  if (!(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
  }

  const rule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!rule) return NextResponse.json({ error: 'No active payout rule' }, { status: 500 })

  // Drivers share the price after Trashit's platform fee (the "driver pool").
  const driverPool = driverPoolFromSnapshot(order.quoteSnapshot)
  if (driverPool === null) {
    return NextResponse.json({ error: 'This order has an invalid price' }, { status: 400 })
  }

  let flagged = false
  let distanceMeters: number | null = null
  if (gps.lat != null && gps.lng != null && order.latitude != null && order.longitude != null) {
    distanceMeters = distanceInMeters(order.latitude, order.longitude, gps.lat, gps.lng)
    flagged = distanceMeters > GEOFENCE_THRESHOLD_METERS
  }

  const payoutAmount = Math.round(driverPool * rule.pickupPercent) / 100
  const idempotencyKey = `pickup-${orderId}`
  const auditReason = flagged
    ? `Driver confirmed pickup with photo evidence (GPS MISMATCH: photo taken ~${Math.round(distanceMeters as number)}m from pickup address)`
    : 'Driver confirmed pickup with photo evidence'

  try {
    await prisma.$transaction(async (tx) => {
      // Only succeeds if the order is still ASSIGNED to this driver right now.
      const moved = await tx.order.updateMany({
        where: { id: orderId, driverId: user.id, status: 'ASSIGNED' },
        data: { status: 'PICKED_UP' },
      })
      if (moved.count !== 1) throw new Error('STATE_CHANGED')

      await tx.orderEvidence.create({
        data: {
          orderId,
          type: 'driver_pickup',
          photoUrl: photoPath,
          gpsLat: gps.lat,
          gpsLng: gps.lng,
          capturedAt: new Date(),
        },
      })
      await tx.ledgerEntry.create({
        data: { orderId, type: 'driver_payout_pickup', amount: payoutAmount, idempotencyKey, driverId: user.id },
      })
      await tx.auditLog.create({
        data: { orderId, actorId: user.id, fromState: 'ASSIGNED', toState: 'PICKED_UP', reason: auditReason },
      })
    })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2002') return NextResponse.json({ success: true, note: 'Already processed' })
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 })
    }
    console.error('[confirm-pickup] failed:', e)
    return NextResponse.json({ error: 'Could not confirm pickup. Please try again.' }, { status: 500 })
  }

  await notifyCustomerCollected(orderId)
  return NextResponse.json({ success: true, payoutAmount, flagged, distanceMeters })
}