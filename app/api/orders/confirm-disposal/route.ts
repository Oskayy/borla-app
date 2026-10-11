import { NextRequest, NextResponse } from 'next/server'
import { notifyCustomersCompleted } from '@/lib/customer-updates'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'
import { releaseDisposal } from '@/lib/disposal-release'
import { getShiftSettings } from '@/lib/settings'
import { caught } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'confirm_disposal', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  const photoPath = body?.photoPath
  const gps = parseGps(body)

  if (!isUuid(orderId) || !gps.ok) {
    return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  }
  if (!isValidEvidencePath(photoPath, orderId)) {
    return NextResponse.json({ error: 'A valid photo is required to confirm disposal' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.driverId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'PICKED_UP') {
    return NextResponse.json({ error: 'Order not eligible for disposal confirmation' }, { status: 400 })
  }

  // Orders on a planned route are unloaded per trip, with the site's geofence check (see /api/driver/trip-disposal).
  if (await prisma.routeStop.count({ where: { orderId } })) {
    return NextResponse.json(
      { error: 'This order is on a trip. Use "Confirm unload" at the disposal site for the whole trip.' },
      { status: 409 }
    )
  }

  if (!(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
  }

  const settings = await getShiftSettings()
  let payoutAmount = 0

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderEvidence.create({
        data: {
          orderId,
          type: 'driver_pickup', // reused type; the "disposal-" file name tells them apart
          photoUrl: photoPath,
          gpsLat: gps.lat,
          gpsLng: gps.lng,
          capturedAt: new Date(),
        },
      })
      payoutAmount = await releaseDisposal(tx, {
        orders: [{ id: orderId, shiftDate: order.shiftDate }],
        fromStatus: 'PICKED_UP',
        driverId: user.id,
        settings,
        facilityId: null,
        method: 'driver_photo',
        actorId: user.id,
        reason: 'Driver confirmed disposal with photo evidence',
      })
    })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2002') return NextResponse.json({ success: true, note: 'Already processed' })
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 })
    }
    if (e?.message === 'BAD_PRICE' || e?.message === 'NO_PAYOUT_RULE') {
      console.error('[confirm-disposal] cannot work out the pay:', e.message, orderId)
      return NextResponse.json({ error: "This stop's pay can't be worked out right now. Please call Trashit support." }, { status: 409 })
    }
    console.error('[confirm-disposal] failed:', e)
    return NextResponse.json({ error: 'Could not confirm disposal. Please try again.' }, { status: 500 })
  }

  await notifyCustomersCompleted([orderId])
  return NextResponse.json({ success: true, payoutAmount })
}