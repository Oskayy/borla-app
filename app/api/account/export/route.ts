import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { customerStatus } from '@/lib/order-status'

// "Download my data": everything Trashit holds about this customer, as a JSON file.
// Leaves out internal staff notes and anything about other people (drivers are named by first name only).
export async function GET() {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'data_export', maxAttempts: 5, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const id = auth.user.id
  const [me, profile, orders, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { name: true, phone: true, email: true, createdAt: true } }),
    prisma.customerProfile.findUnique({
      where: { userId: id },
      select: { address: true, homeLat: true, homeLng: true, homeUpdatedAt: true, homeLandmark: true, zone: { select: { name: true } } },
    }),
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        shiftDate: true,
        cancelledAt: true,
        cancelReason: true,
        latitude: true,
        longitude: true,
        quoteSnapshot: true,
        driver: { select: { name: true } },
        payments: { select: { amount: true, status: true, providerRef: true, createdAt: true } },
        refunds: { where: { status: { not: 'AWAITING_APPROVAL' } }, select: { amount: true, status: true, createdAt: true } },
        rating: { select: { stars: true, comment: true, createdAt: true } },
        evidence: { where: { type: 'customer_placement' }, select: { createdAt: true, gpsLat: true, gpsLng: true } },
      },
    }),
    prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'asc' }, select: { title: true, body: true, createdAt: true, readAt: true } }),
  ])

  const data = {
    exportedAt: new Date().toISOString(),
    about: 'Your Trashit data. Photos are not included in this file; ask Trashit support if you need copies.',
    account: me,
    homePin: profile && { address: profile.address, landmark: profile.homeLandmark, lat: profile.homeLat, lng: profile.homeLng, area: profile.zone?.name ?? null, updatedAt: profile.homeUpdatedAt },
    orders: orders.map((o) => ({
      id: o.id,
      status: customerStatus(o.status).label,
      bookedAt: o.createdAt,
      collectionNight: o.shiftDate,
      cancelledAt: o.cancelledAt,
      cancelReason: o.cancelReason,
      pin: o.latitude != null ? { lat: o.latitude, lng: o.longitude } : null,
      details: o.quoteSnapshot,
      driverFirstName: o.driver?.name.split(/\s+/)[0] ?? null,
      payments: o.payments,
      refunds: o.refunds,
      rating: o.rating,
      yourPhotos: o.evidence.map((e) => ({ takenAt: e.createdAt, lat: e.gpsLat, lng: e.gpsLng })),
    })),
    notifications,
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="trashit-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
