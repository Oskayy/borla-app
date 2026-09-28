import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, isValidLat, isValidLng, readJson } from '@/lib/validate'

const VEHICLE_TYPES = ['Aboboyaa tricycle', 'Borla car']

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_profile', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const vehicleType = body?.vehicleType
  const vehiclePlate = body?.vehiclePlate ? cleanText(body.vehiclePlate, 20) : null
  const homeAddress = body?.homeAddress ? cleanText(body.homeAddress, 200) : null
  const zoneId = body?.zoneId ? body.zoneId : null
  const homeLat = body?.homeLat ?? null
  const homeLng = body?.homeLng ?? null

  if (typeof vehicleType !== 'string' || !VEHICLE_TYPES.includes(vehicleType)) {
    return NextResponse.json({ error: 'Please choose a valid vehicle type' }, { status: 400 })
  }
  if ((body?.vehiclePlate && !vehiclePlate) || (body?.homeAddress && !homeAddress)) {
    return NextResponse.json({ error: 'Please check your plate number and address' }, { status: 400 })
  }
  if ((homeLat === null) !== (homeLng === null) || (homeLat !== null && (!isValidLat(homeLat) || !isValidLng(homeLng)))) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
  }

  if (zoneId !== null) {
    if (!isUuid(zoneId)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })
    const zone = await prisma.zone.findFirst({ where: { id: zoneId, active: true } })
    if (!zone) return NextResponse.json({ error: 'That zone is not available' }, { status: 400 })
  }

  const updated = await prisma.driverProfile.updateMany({
    where: { userId: auth.user.id },
    data: { vehicleType, vehiclePlate, zoneId, homeAddress, homeLat, homeLng },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}