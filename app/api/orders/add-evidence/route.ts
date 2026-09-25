import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { distanceInMeters, GEOFENCE_THRESHOLD_METERS } from '@/lib/geo'

export async function POST(req: NextRequest) {
  const { orderId, photoPath, type, gpsLat, gpsLng } = await req.json()

  if (!orderId || !photoPath) {
    return NextResponse.json({ error: 'Missing orderId or photoPath' }, { status: 400 })
  }

  let flagged = false
  let distanceMeters: number | null = null

  if (gpsLat != null && gpsLng != null) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { latitude: true, longitude: true },
    })

    if (order?.latitude != null && order?.longitude != null) {
      distanceMeters = distanceInMeters(order.latitude, order.longitude, gpsLat, gpsLng)
      flagged = distanceMeters > GEOFENCE_THRESHOLD_METERS
    }
  }

  await prisma.orderEvidence.create({
    data: {
      orderId,
      type: type || 'customer_placement',
      photoUrl: photoPath,
      gpsLat: gpsLat ?? null,
      gpsLng: gpsLng ?? null,
      capturedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, flagged, distanceMeters })
}