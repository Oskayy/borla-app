import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { createAdminClient } from '@/lib/supabase-admin'
import { APPROVAL_ROLES, DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import { approvedRadius, VEHICLE_CHANGE_DOC } from '@/lib/vehicle-change'
import { notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'

// Approve or send back a driver's change of vehicle type.
// Approving switches the vehicle (and so its capacity) for dispatch; the new photo becomes their vehicle photo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(APPROVAL_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'vehicle_change_review', maxAttempts: 100, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid driver' }, { status: 400 })
  const body = await readJson(req)
  const decision = body?.decision
  const note = cleanText(body?.note, 300)
  if (decision !== 'approve' && decision !== 'reject') return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  if (decision === 'reject' && (!note || note.length < 3)) {
    return NextResponse.json({ error: 'Please tell the driver what to fix' }, { status: 400 })
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: id },
    select: { pendingVehicleTypeId: true, pendingVehicleAt: true, pendingRadiusKm: true, radiusKm: true },
  })
  if (!profile?.pendingVehicleTypeId || !profile.pendingVehicleAt) {
    return NextResponse.json({ error: 'No vehicle change is waiting for this driver' }, { status: 409 })
  }
  const docs = await prisma.driverDocument.findMany({
    where: { driverId: id, type: { in: [VEHICLE_CHANGE_DOC, 'vehicle_photo'] } },
    select: { id: true, type: true, path: true },
  })
  const changePhotos = docs.filter((d) => d.type === VEHICLE_CHANGE_DOC)
  const oldPhotos = docs.filter((d) => d.type === 'vehicle_photo')
  const clear = { pendingVehicleTypeId: null, pendingRadiusKm: null, pendingVehicleAt: null }
  const storage = () => createAdminClient().storage.from(DRIVER_DOCS_BUCKET)

  if (decision === 'approve') {
    const vehicle = await prisma.vehicleType.findUnique({ where: { id: profile.pendingVehicleTypeId } })
    if (!vehicle?.active) return NextResponse.json({ error: 'That vehicle type is no longer offered' }, { status: 409 })
    const radiusKm = approvedRadius(profile.pendingRadiusKm, profile.radiusKm, vehicle.maxRadiusKm, vehicle.defaultRadiusKm)
    try {
      await prisma.$transaction(async (tx) => {
        // Only the exact change that was reviewed (the driver may have changed it again meanwhile).
        const done = await tx.driverProfile.updateMany({
          where: { userId: id, pendingVehicleTypeId: vehicle.id, pendingVehicleAt: profile.pendingVehicleAt },
          data: { ...clear, vehicleTypeId: vehicle.id, vehicleType: vehicle.name, radiusKm, vehicleChangeNote: null },
        })
        if (done.count !== 1) throw new Error('STATE_CHANGED')
        if (changePhotos.length > 0) {
          await tx.driverDocument.deleteMany({ where: { id: { in: oldPhotos.map((d) => d.id) } } })
          await tx.driverDocument.updateMany({ where: { id: { in: changePhotos.map((d) => d.id) } }, data: { type: 'vehicle_photo' } })
        }
      })
    } catch (err) {
      if (caught(err)?.message === 'STATE_CHANGED') {
        return NextResponse.json({ error: 'The driver changed this request. Refresh to see the latest.' }, { status: 409 })
      }
      throw err
    }
    if (changePhotos.length > 0 && oldPhotos.length > 0) {
      await storage()
        .remove(oldPhotos.map((d) => d.path))
        .catch((e) => console.error('[vehicle-change] could not remove old photo', e))
    }
    await logAdminAction(auth.user.id, 'VEHICLE_CHANGE_APPROVED', id, vehicle.name)
    await notifyUser(id, {
      title: 'Vehicle change approved',
      body: `You're now set up with your ${vehicle.name.toLowerCase()}. New stops will be planned for its size.`,
      url: '/dashboard/driver/profile-setup',
    })
    return NextResponse.json({ success: true })
  }

  await prisma.driverProfile.update({ where: { userId: id }, data: { ...clear, vehicleChangeNote: note } })
  if (changePhotos.length > 0) {
    await prisma.driverDocument.deleteMany({ where: { id: { in: changePhotos.map((d) => d.id) } } })
    await storage()
      .remove(changePhotos.map((d) => d.path))
      .catch((e) => console.error('[vehicle-change] could not remove photo', e))
  }
  await logAdminAction(auth.user.id, 'VEHICLE_CHANGE_REJECTED', id, note ?? '')
  await notifyUser(id, {
    title: 'Vehicle change not approved',
    body: `${note}. You can keep working with your current vehicle, or try the change again.`,
    url: '/dashboard/driver/profile-setup',
  })
  return NextResponse.json({ success: true })
}
