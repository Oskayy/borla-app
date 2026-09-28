import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from '@/lib/geo'
import { findZoneForPoint, parseOrderInput, quoteForZone, type QuoteSnapshot } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'add_evidence', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  const photoPath = body?.photoPath
  const gps = parseGps(body)

  if (!isUuid(orderId) || !isValidEvidencePath(photoPath, orderId) || !gps.ok) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerId: true, status: true, latitude: true, longitude: true, zoneId: true, quoteSnapshot: true },
  })
  if (!order || order.customerId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Photos can only be added before payment' }, { status: 400 })
  }

  const existingCount = await prisma.orderEvidence.count({ where: { orderId } })
  if (existingCount >= 3) {
    return NextResponse.json({ error: 'Too many photos for this order' }, { status: 400 })
  }

  if (!(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
  }

  let flagged = false
  let distanceMeters: number | null = null
  if (gps.lat != null && gps.lng != null && order.latitude != null && order.longitude != null) {
    distanceMeters = distanceInMeters(order.latitude, order.longitude, gps.lat, gps.lng)
    flagged = distanceMeters > GEOFENCE_THRESHOLD_METERS
  }

  // Zones price differently, so someone could type an address in a cheaper zone.
  // If the photo was taken well away from the address AND inside a pricier zone, re-quote at that zone's price.
  let requote: { oldPrice: number; newPrice: number; zoneName: string; collectionLabel: string } | null = null
  if (flagged && gps.lat != null && gps.lng != null) {
    const snapshot = order.quoteSnapshot as unknown as QuoteSnapshot | null
    const input = parseOrderInput(snapshot)
    const photoZone = await findZoneForPoint(gps.lat, gps.lng)
    const currentMultiplier = typeof snapshot?.zoneMultiplier === 'number' ? snapshot.zoneMultiplier : 1

    if (snapshot && input && photoZone && photoZone.id !== order.zoneId && photoZone.priceMultiplier > currentMultiplier) {
      const priced = await quoteForZone(input, photoZone)
      if (priced.ok && priced.quote.price > snapshot.price) {
        const updated: QuoteSnapshot = {
          ...priced.quote,
          address: snapshot.address,
          requotedFrom: { zoneId: snapshot.zoneId, zoneName: snapshot.zoneName, price: snapshot.price },
        }
        await prisma.order.update({
          where: { id: orderId },
          data: { zoneId: photoZone.id, quoteSnapshot: updated as unknown as Prisma.InputJsonValue },
        })
        await prisma.auditLog.create({
          data: {
            orderId,
            actorId: null,
            fromState: 'DRAFT',
            toState: 'DRAFT',
            reason: `Re-quoted: photo taken in ${photoZone.name} (x${photoZone.priceMultiplier}), address was in ${snapshot.zoneName} (x${currentMultiplier}). GHS ${snapshot.price} -> GHS ${updated.price}`,
          },
        })
        requote = {
          oldPrice: snapshot.price,
          newPrice: updated.price,
          zoneName: photoZone.name,
          collectionLabel: updated.collectionLabel,
        }
      }
    }
  }

  await prisma.orderEvidence.create({
    data: {
      orderId,
      type: 'customer_placement',
      photoUrl: photoPath,
      gpsLat: gps.lat,
      gpsLng: gps.lng,
      capturedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, flagged, distanceMeters, requote })
}