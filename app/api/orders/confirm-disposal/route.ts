import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'

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
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
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

  if (!(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
  }

  const rule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!rule) return NextResponse.json({ error: 'No active payout rule' }, { status: 500 })

  const quote = order.quoteSnapshot as { price?: number } | null
  const price = quote?.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'This order has an invalid price' }, { status: 400 })
  }

  const payoutAmount = Math.round(price * rule.disposalPercent) / 100
  const idempotencyKey = `disposal-${orderId}`

  try {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: orderId, driverId: user.id, status: 'PICKED_UP' },
        data: { status: 'COMPLETED' },
      })
      if (moved.count !== 1) throw new Error('STATE_CHANGED')

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
      await tx.ledgerEntry.create({
        data: { orderId, type: 'driver_payout_disposal', amount: payoutAmount, idempotencyKey },
      })
      await tx.auditLog.create({
        data: {
          orderId,
          actorId: user.id,
          fromState: 'PICKED_UP',
          toState: 'COMPLETED',
          reason: 'Driver confirmed disposal with photo evidence',
        },
      })
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ success: true, note: 'Already processed' })
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 })
    }
    console.error('[confirm-disposal] failed:', e)
    return NextResponse.json({ error: 'Could not confirm disposal. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, payoutAmount })
}