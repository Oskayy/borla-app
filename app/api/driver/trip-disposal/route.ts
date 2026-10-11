import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'
import { distanceInMeters } from '@/lib/geo'
import { releaseDisposal } from '@/lib/disposal-release'
import { getShiftSettings } from '@/lib/settings'
import { notifyCustomersCompleted } from '@/lib/customer-updates'
import { caught } from '@/lib/errors'

// Extra metres allowed on top of a site's geofence, because phone GPS drifts.
const GPS_TOLERANCE_M = 50

// The driver unloads one trip at its disposal site and takes one photo there.
// Inside the site's geofence: every collected order on the trip is completed and the disposal share is paid.
// Outside it, or with no GPS: the orders wait for ops to review the photo, and nothing is paid yet.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'confirm_disposal', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const routeId = body?.routeId
  const tripNumber = body?.tripNumber
  const photoPath = body?.photoPath
  const gps = parseGps(body)
  if (!isUuid(routeId) || !Number.isInteger(tripNumber) || tripNumber < 1 || !gps.ok) {
    return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  }

  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      trips: { where: { tripNumber }, include: { facility: true } },
      stops: { where: { tripNumber }, include: { order: true } },
    },
  })
  if (!route || route.driverId !== user.id) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const onBoard = route.stops.map((s) => s.order).filter((o) => o.driverId === user.id && o.status === 'PICKED_UP')
  if (onBoard.length === 0) {
    return NextResponse.json({ error: 'Nothing on this trip has been collected yet' }, { status: 400 })
  }

  // The photo is stored under one of this trip's orders.
  if (typeof photoPath !== 'string' || !onBoard.some((o) => isValidEvidencePath(photoPath, o.id))) {
    return NextResponse.json({ error: 'A valid photo is required to confirm unloading' }, { status: 400 })
  }
  if (!(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
  }

  const site = route.trips[0]?.facility ?? null

  // Is the photo inside the site's geofence?
  let distanceM: number | null = null
  let inside = false
  if (site?.lat != null && site?.lng != null && gps.lat != null && gps.lng != null) {
    distanceM = Math.round(distanceInMeters(gps.lat, gps.lng, site.lat, site.lng))
    inside = distanceM <= site.geofenceRadiusM + GPS_TOLERANCE_M
  }

  const settings = await getShiftSettings()

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // One photo record per order, all pointing at the same picture.
        await tx.orderEvidence.createMany({
          data: onBoard.map((o) => ({
            orderId: o.id,
            type: 'driver_disposal',
            photoUrl: photoPath,
            gpsLat: gps.lat,
            gpsLng: gps.lng,
            capturedAt: new Date(),
          })),
        })

        if (inside) {
          const paid = await releaseDisposal(tx, {
            orders: onBoard,
            fromStatus: 'PICKED_UP',
            driverId: user.id,
            settings,
            facilityId: site!.id,
            method: 'geofence',
            actorId: user.id,
            reason: `Unloaded at ${site!.name} (photo ${distanceM} m from site, trip ${tripNumber})`,
          })
          return { verified: true, paid }
        }

        // Needs a human look: outside the geofence, no GPS, or no site on the trip.
        const why = !site
          ? 'no disposal site was set for this trip'
          : distanceM == null
          ? 'the photo had no GPS location'
          : `the photo was ${distanceM} m from ${site.name} (allowed ${site.geofenceRadiusM + GPS_TOLERANCE_M} m)`
        const moved = await tx.order.updateMany({
          where: { id: { in: onBoard.map((o) => o.id) }, driverId: user.id, status: 'PICKED_UP' },
          data: { status: 'DISPOSAL_PENDING' },
        })
        if (moved.count !== onBoard.length) throw new Error('STATE_CHANGED')
        await tx.auditLog.createMany({
          data: onBoard.map((o) => ({
            orderId: o.id,
            actorId: user.id,
            fromState: 'PICKED_UP',
            toState: 'DISPOSAL_PENDING',
            reason: `DISPOSAL NEEDS REVIEW: ${why} (trip ${tripNumber})`,
          })),
        })
        return { verified: false, paid: 0, why }
      },
      { timeout: 20000 }
    )

    if (result.verified) await notifyCustomersCompleted(onBoard.map((o) => o.id))
    return NextResponse.json({ success: true, orders: onBoard.length, distanceM, ...result })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2002') return NextResponse.json({ success: true, note: 'Already processed' })
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'This trip was just updated. Please refresh.' }, { status: 409 })
    }
    if (e?.message === 'BAD_PRICE' || e?.message === 'NO_PAYOUT_RULE') {
      console.error('[trip-disposal] cannot work out the pay:', e.message)
      return NextResponse.json({ error: "Pay for this trip can't be worked out right now. Please call Trashit support." }, { status: 409 })
    }
    console.error('[trip-disposal] failed:', e)
    return NextResponse.json({ error: 'Could not confirm unloading. Please try again.' }, { status: 500 })
  }
}
