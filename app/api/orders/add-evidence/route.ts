import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from '@/lib/geo'

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
    select: { customerId: true, status: true, latitude: true, longitude: true },
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

  return NextResponse.json({ success: true, flagged, distanceMeters })
}