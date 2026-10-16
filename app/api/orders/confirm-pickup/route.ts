import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, evidenceFileHash, isValidEvidencePath } from '@/lib/storage'
import { PICKUP_CHECK_MARKER, pickupFlags } from '@/lib/plausibility'
import { ensureSplit } from '@/lib/order-split-server'
import { PICKUP_TYPE } from '@/lib/earnings'
import { postJournal } from '@/lib/journal-server'
import { earnedLines } from '@/lib/accounts'
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from '@/lib/geo'
import { notifyCustomerCollected } from '@/lib/customer-updates'
import { caught } from '@/lib/errors'
import { minutesLate, parseTakenAt } from '@/lib/taken-at'

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
    return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  }
  if (!isValidEvidencePath(photoPath, orderId)) {
    return NextResponse.json({ error: 'A valid photo is required to confirm pickup' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.driverId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  // The same pickup sent again (the phone kept it while there was no signal, lib/outbox.ts) counts as done.
  if (order.status !== 'ASSIGNED') {
    const done = await prisma.orderEvidence.findFirst({ where: { orderId, type: 'driver_pickup', photoUrl: photoPath }, select: { id: true } })
    if (done) return NextResponse.json({ success: true, already: true })
    return NextResponse.json({ error: 'Order not eligible for pickup confirmation' }, { status: 400 })
  }
  if (!order.driverAcceptedAt) {
    return NextResponse.json({ error: 'Please accept this stop first' }, { status: 409 })
  }

  if (!(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
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
  // When the photo was taken: a pickup sent late keeps its own time, so the speed check between pickups stays right.
  const takenAt = parseTakenAt(body?.takenAt, now)
  const late = minutesLate(takenAt, now)
  const [photoHash, previous] = await Promise.all([
    evidenceFileHash(photoPath),
    prisma.orderEvidence.findFirst({
      where: {
        type: 'driver_pickup',
        order: { driverId: user.id },
        gpsLat: { not: null },
        gpsLng: { not: null },
        capturedAt: { gte: new Date(takenAt.getTime() - 6 * 3600_000), lte: takenAt },
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
    at: takenAt,
    photoUsedElsewhere: !!reused,
  })

  let payoutPesewas = 0
  const idempotencyKey = `pickup-${orderId}`
  const sentLate = late ? `, sent ${late} min after the photo (no signal)` : ''
  const auditReason = checks.length
    ? `Driver confirmed pickup with photo evidence${sentLate} (${PICKUP_CHECK_MARKER}: ${checks.join('; ')})`
    : `Driver confirmed pickup with photo evidence${sentLate}`

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
          capturedAt: takenAt,
        },
      })
      // The pickup share, from the split frozen at payment. It can't be withdrawn until the load is unloaded
      // and the clearing period has passed (lib/earnings.ts).
      const split = await ensureSplit(tx, orderId)
      payoutPesewas = split.pickup
      await tx.ledgerEntry.create({
        data: { orderId, type: PICKUP_TYPE, amount: split.pickup / 100, amountPesewas: split.pickup, idempotencyKey, driverId: user.id, clearsAt: null },
      })
      await postJournal(tx, { key: idempotencyKey, event: 'earned', orderId, driverId: user.id, lines: earnedLines(orderId, user.id, split.pickup) })
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
    if (e?.message === 'BAD_PRICE' || e?.message === 'NO_PAYOUT_RULE') {
      console.error('[confirm-pickup] cannot work out the pay:', e.message, orderId)
      return NextResponse.json({ error: "This stop's pay can't be worked out right now. Please call Trashit support before collecting." }, { status: 409 })
    }
    console.error('[confirm-pickup] failed:', e)
    return NextResponse.json({ error: 'Could not confirm pickup. Please try again.' }, { status: 500 })
  }

  await notifyCustomerCollected(orderId)
  return NextResponse.json({ success: true, payoutAmount: payoutPesewas / 100, flagged, distanceMeters })
}