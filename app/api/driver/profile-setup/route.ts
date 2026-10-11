import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, isValidLat, isValidLng, readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { createAdminClient } from '@/lib/supabase-admin'
import { DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import { planVehicleChange, VEHICLE_CHANGE_DOC } from '@/lib/vehicle-change'
import { parseGhanaCard, parsePlate } from '@/lib/ghana-card'
import { caught } from '@/lib/errors'

// Saves the driver's vehicle, home base (where they start each night) and working radius.
// An approved driver's change of vehicle type waits for ops (lib/vehicle-change.ts); everything else saves now.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_profile', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const vehicleTypeId = body?.vehicleTypeId
  const vehiclePlate = parsePlate(body?.vehiclePlate)
  const homeAddress = body?.homeAddress ? cleanText(body.homeAddress, 200) : null
  const zoneId = body?.zoneId ? body.zoneId : null
  const homeLat = body?.homeLat
  const homeLng = body?.homeLng

  if (!isUuid(vehicleTypeId)) {
    return NextResponse.json({ error: 'Please choose your vehicle' }, { status: 400 })
  }
  const vehicle = await prisma.vehicleType.findFirst({ where: { id: vehicleTypeId, active: true } })
  if (!vehicle) return NextResponse.json({ error: 'That vehicle is not available' }, { status: 400 })

  if (!vehiclePlate) {
    return NextResponse.json({ error: 'Please enter your vehicle number plate, e.g. GT 1234-24' }, { status: 400 })
  }
  if (body?.homeAddress && !homeAddress) {
    return NextResponse.json({ error: 'Please check your address' }, { status: 400 })
  }

  // The home base is needed to plan each night's routes, so it is now required.
  if (!isValidLat(homeLat) || !isValidLng(homeLng)) {
    return NextResponse.json({ error: 'Please pin your home base on the map' }, { status: 400 })
  }

  // The radius must stay within the limit set for this vehicle.
  const radiusKm = inRange(body?.radiusKm, 0.5, vehicle.maxRadiusKm)
  if (radiusKm === null) {
    return NextResponse.json(
      { error: `Your radius must be between 0.5 and ${vehicle.maxRadiusKm} km for a ${vehicle.name.toLowerCase()}` },
      { status: 400 }
    )
  }

  if (zoneId !== null) {
    if (!isUuid(zoneId)) return NextResponse.json({ error: 'Please choose a zone from the list.' }, { status: 400 })
    const zone = await prisma.zone.findFirst({ where: { id: zoneId, active: true } })
    if (!zone) return NextResponse.json({ error: 'That zone is not available' }, { status: 400 })
  }

  const current = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { approvalStatus: true, vehicleTypeId: true, pendingVehicleTypeId: true, vehicleTypeRef: { select: { maxRadiusKm: true } } },
  })
  if (!current) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  // Before approval: the Ghana Card number and a photo of the vehicle are required. After approval they are locked.
  const approved = current.approvalStatus === 'APPROVED'
  let ghanaCardNumber: string | undefined
  if (!approved) {
    const card = parseGhanaCard(body?.ghanaCardNumber)
    if (!card) {
      return NextResponse.json({ error: 'Please enter your Ghana Card number, e.g. GHA-123456789-0' }, { status: 400 })
    }
    ghanaCardNumber = card
    const photos = await prisma.driverDocument.count({ where: { driverId: auth.user.id, type: 'vehicle_photo' } })
    if (photos === 0) return NextResponse.json({ error: 'Please add a photo of your vehicle' }, { status: 400 })
  }

  const plan = planVehicleChange({
    approved: current.approvalStatus === 'APPROVED',
    currentVehicleId: current.vehicleTypeId,
    requestedVehicleId: vehicle.id,
    requestedRadiusKm: radiusKm,
    currentMaxRadiusKm: current.vehicleTypeRef?.maxRadiusKm ?? null,
  })
  const place = { vehiclePlate, zoneId, homeAddress, homeLat, homeLng, ...(ghanaCardNumber ? { ghanaCardNumber } : {}) }

  if (plan.kind === 'pending') {
    // Keep working on today's vehicle; the new one waits for a photo and ops approval.
    const changed = current.pendingVehicleTypeId !== vehicle.id
    await prisma.driverProfile.update({
      where: { userId: auth.user.id },
      data: {
        ...place,
        radiusKm: plan.currentRadiusKm,
        pendingVehicleTypeId: vehicle.id,
        pendingRadiusKm: radiusKm,
        vehicleChangeNote: null,
        ...(changed ? { pendingVehicleAt: null } : {}),
      },
    })
    // A different vehicle than the one already asked for needs a new photo.
    if (changed) await removeChangePhotos(auth.user.id)
    return NextResponse.json({ success: true, vehicleChange: 'pending' })
  }

  try {
    await prisma.driverProfile.update({
      where: { userId: auth.user.id },
      data: {
        ...place,
        vehicleTypeId: vehicle.id,
        vehicleType: vehicle.name, // kept in step for older screens that read the name
        radiusKm,
        // Choosing today's vehicle again cancels a change that was waiting.
        pendingVehicleTypeId: null,
        pendingRadiusKm: null,
        pendingVehicleAt: null,
      },
    })
  } catch (err) {
    if (caught(err)?.code === 'P2002') {
      return NextResponse.json(
        { error: 'That Ghana Card number is already on another driver account. Contact Trashit if this is wrong.' },
        { status: 409 }
      )
    }
    throw err
  }
  if (current.pendingVehicleTypeId) await removeChangePhotos(auth.user.id)

  return NextResponse.json({ success: true })
}

// Deletes the photo sent with a vehicle change (records and files).
async function removeChangePhotos(driverId: string) {
  const docs = await prisma.driverDocument.findMany({ where: { driverId, type: VEHICLE_CHANGE_DOC }, select: { id: true, path: true } })
  if (docs.length === 0) return
  await prisma.driverDocument.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } })
  await createAdminClient()
    .storage.from(DRIVER_DOCS_BUCKET)
    .remove(docs.map((d) => d.path))
    .catch((e) => console.error('[vehicle-change] could not remove photo', e))
}