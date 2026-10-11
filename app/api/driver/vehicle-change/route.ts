import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase-admin'
import { APPROVAL_ROLES, DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import { VEHICLE_CHANGE_DOC } from '@/lib/vehicle-change'
import { notifyUsers } from '@/lib/notify'

// An approved driver sends their vehicle change for review ("send"), or drops it ("cancel").
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'vehicle_change', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const action = (await readJson(req))?.action
  if (action !== 'send' && action !== 'cancel') return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { pendingVehicleTypeId: true, pendingVehicleAt: true },
  })
  if (!profile) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  if (action === 'cancel') {
    await prisma.driverProfile.update({
      where: { userId: auth.user.id },
      data: { pendingVehicleTypeId: null, pendingRadiusKm: null, pendingVehicleAt: null, vehicleChangeNote: null },
    })
    const docs = await prisma.driverDocument.findMany({ where: { driverId: auth.user.id, type: VEHICLE_CHANGE_DOC }, select: { id: true, path: true } })
    if (docs.length > 0) {
      await prisma.driverDocument.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } })
      await createAdminClient()
        .storage.from(DRIVER_DOCS_BUCKET)
        .remove(docs.map((d) => d.path))
        .catch((e) => console.error('[vehicle-change] could not remove photo', e))
    }
    return NextResponse.json({ success: true })
  }

  if (!profile.pendingVehicleTypeId) return NextResponse.json({ error: 'Choose your new vehicle first' }, { status: 409 })
  if (profile.pendingVehicleAt) return NextResponse.json({ success: true }) // already sent
  const photos = await prisma.driverDocument.count({ where: { driverId: auth.user.id, type: VEHICLE_CHANGE_DOC } })
  if (photos === 0) return NextResponse.json({ error: 'Please add a photo of your new vehicle' }, { status: 400 })

  await prisma.driverProfile.update({ where: { userId: auth.user.id }, data: { pendingVehicleAt: new Date() } })
  const staff = await prisma.user.findMany({ where: { role: { in: APPROVAL_ROLES }, active: true }, select: { id: true } })
  await notifyUsers(
    staff.map((s: { id: string }) => s.id),
    { title: 'Vehicle change to approve', body: 'A driver wants to switch vehicle. Review it on the Driver Approvals page.', url: '/ops/driver-approvals' }
  )
  return NextResponse.json({ success: true })
}
