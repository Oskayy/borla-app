import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isValidLat, isValidLng, readJson } from '@/lib/validate'
import { getShiftSettings } from '@/lib/settings'
import { isDriverAvailable } from '@/lib/shift'

// Live position from the driver's phone. Only stored while the driver is online and working
// (during the shift, or with an ops override). Otherwise the driver is switched offline and nothing is kept.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_location', maxAttempts: 200, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  if (!isValidLat(body?.lat) || !isValidLng(body?.lng)) {
    return NextResponse.json({ error: "We couldn't read your location. Please try again." }, { status: 400 })
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { isOnline: true, onlineOverrideUntil: true },
  })
  if (!profile) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const settings = await getShiftSettings()
  if (!isDriverAvailable(profile, new Date(), settings)) {
    // The shift has ended (or the driver never went online): make sure they're offline and store nothing.
    if (profile.isOnline) {
      await prisma.driverProfile.update({
        where: { userId: auth.user.id },
        data: { isOnline: false, wentOnlineAt: null, currentLat: null, currentLng: null, lastLocationAt: null },
      })
    }
    return NextResponse.json({ success: false, offline: true }, { status: 409 })
  }

  await prisma.driverProfile.update({
    where: { userId: auth.user.id },
    data: { currentLat: body.lat, currentLng: body.lng, lastLocationAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
