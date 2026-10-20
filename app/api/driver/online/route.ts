import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { getShiftSettings } from '@/lib/settings'
import { formatClock, hasActiveOverride, isWithinShift } from '@/lib/shift'
import { openWork, releaseStopsOnOffline } from '@/lib/driver-offline-server'

// Driver presses "Go online" / "Go offline".
// Going online is only allowed during shift hours, unless ops have given this driver an override.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_online', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const online = body?.online
  const confirmed = body?.confirm === true // the driver saw what going offline does to their stops
  if (typeof online !== 'boolean') return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { isOnline: true, isActive: true, vehicleTypeId: true, homeLat: true, onlineOverrideUntil: true, approvalStatus: true },
  })
  if (!profile) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const now = new Date()

  if (!online) {
    // During the shift, stops still to collect go to other drivers when this driver goes offline. Ask first.
    const duringShift = profile.isOnline && (isWithinShift(now, await getShiftSettings()) || hasActiveOverride(profile, now))
    const work = duringShift ? await openWork(auth.user.id) : { toCollect: 0, onBoard: 0 }
    if (work.toCollect > 0 && !confirmed) {
      return NextResponse.json({ needsConfirm: true, toCollect: work.toCollect, onBoard: work.onBoard }, { status: 409 })
    }

    // Going offline also forgets the live position: we only keep it while the driver is working.
    await prisma.driverProfile.update({
      where: { userId: auth.user.id },
      data: { isOnline: false, wentOnlineAt: null, currentLat: null, currentLng: null, lastLocationAt: null },
    })
    if (profile.isOnline) await logAdminAction(auth.user.id, 'DRIVER_OFFLINE', auth.user.id, 'Driver went offline')
    if (work.toCollect > 0 || work.onBoard > 0) {
      const me = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true } })
      const result = await releaseStopsOnOffline(auth.user.id, me?.name ?? 'A driver')
      return NextResponse.json({ success: true, online: false, ...result })
    }
    return NextResponse.json({ success: true, online: false })
  }

  if (profile.approvalStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Your account is waiting for approval. We’ll message you when you can start.' }, { status: 403 })
  }
  if (!profile.isActive) {
    return NextResponse.json({ error: 'Your account is paused. Please contact Trashit support.' }, { status: 403 })
  }
  if (!profile.vehicleTypeId || profile.homeLat == null) {
    return NextResponse.json({ error: 'Please finish setting up your vehicle and home base first.' }, { status: 400 })
  }

  const settings = await getShiftSettings()
  if (!isWithinShift(now, settings) && !hasActiveOverride(profile, now)) {
    return NextResponse.json(
      {
        error: `Collections run from ${formatClock(settings.shiftStartMinutes)} to ${formatClock(settings.shiftEndMinutes)}. You can go online when the shift starts.`,
      },
      { status: 403 }
    )
  }

  await prisma.driverProfile.update({
    where: { userId: auth.user.id },
    data: { isOnline: true, wentOnlineAt: profile.isOnline ? undefined : now },
  })
  if (!profile.isOnline) await logAdminAction(auth.user.id, 'DRIVER_ONLINE', auth.user.id, 'Driver went online')

  return NextResponse.json({ success: true, online: true })
}
