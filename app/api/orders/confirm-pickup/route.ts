import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, evidenceFileHash, isValidEvidencePath } from '@/lib/storage'
import { PICKUP_CHECK_MARKER, pickupFlags } from '@/lib/plausibility'
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
  const accuracy = typeof body?.gpsAccuracy === 'number' && Number.isFinite(body.gpsAccuracy) && body.gpsAccuracy >= 0 ? body.gpsAccuracy : null

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

  // `flagged` (shown to the driver) is only the distance from the pin, as before. The other checks below
  // go to ops only, so the app doesn't explain how to get round them.
  let flagged = false
  let distanceMeters: number | null = null
  if (gps.lat != null && gps.lng != null && order.latitude != null && order.longitude != null) {
    distanceMeters = distanceInMeters(order.latitude, order.longitude, gps.lat, gps.lng)
    flagged = distanceMeters > GEOFENCE_THRESHOLD_METERS
  }

  const now = new Date()
  const [photoHash, previous] = await Promise.all([
    evidenceFileHash(photoPath),
    prisma.orderEvidence.findFirst({
      where: {
        type: 'driver_pickup',
        order: { driverId: user.id },
        gpsLat: { not: null },
        gpsLng: { not: null },
        capturedAt: { gte: new Date(now.getTime() - 6 * 3600_000) },
      },
      orderBy: { capturedAt: 'desc' },
      select: { gpsLat: true, gpsLng: true, capturedAt: true },
    }),
  ])
  const reused = photoHash
    ? await prisma.orderEvidence.findFirst({ where: { photoHash, orderId: { not: orderId } }, select: { id: true } })
    : null
  const checks = pickupFlags({
    gps: gps.lat != null && gps.lng != null ? { lat: gps.lat, lng: gps.lng } : null,
    accuracyM: accuracy,
    pin: order.latitude != null && order.longitude != null ? { lat: order.latitude, lng: order.longitude } : null,
    previous: previous ? { lat: previous.gpsLat!, lng: previous.gpsLng!, at: previous.capturedAt } : null,
    at: now,
    photoUsedElsewhere: !!reused,
  })

  const payoutAmount = Math.round(driverPool * rule.pickupPercent) / 100
  const idempotencyKey = `pickup-${orderId}`
  const auditReason = checks.length
    ? `Driver confirmed pickup with photo evidence (${PICKUP_CHECK_MARKER}: ${checks.join('; ')})`
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
          gpsAccuracy: accuracy,
          photoHash,
          capturedAt: now,
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