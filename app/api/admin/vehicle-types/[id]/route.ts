import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { parseVehicleBody, VEHICLE_EDIT_ROLES } from '@/lib/vehicles'

// Edits a vehicle type. If the maximum radius goes down, drivers above it are brought down to it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(VEHICLE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'vehicle_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid vehicle' }, { status: 400 })

  const parsed = parseVehicleBody(await readJson(req))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.data

  const existing = await prisma.vehicleType.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const { vehicleType, clamped } = await prisma.$transaction(async (tx) => {
    const vehicleType = await tx.vehicleType.update({ where: { id }, data: v })
    const clamped = await tx.driverProfile.updateMany({
      where: { vehicleTypeId: id, radiusKm: { gt: v.maxRadiusKm } },
      data: { radiusKm: v.maxRadiusKm },
    })
    return { vehicleType, clamped: clamped.count }
  })

  await logAdminAction(
    auth.user.id,
    'VEHICLE_TYPE_UPDATED',
    id,
    `"${existing.name}" -> "${v.name}": ${existing.capacityLitres}->${v.capacityLitres} L, radius ${existing.defaultRadiusKm}->${v.defaultRadiusKm} km, max ${existing.maxRadiusKm}->${v.maxRadiusKm} km, active ${existing.active}->${v.active}${clamped ? `, ${clamped} driver radius(es) reduced to the new max` : ''}`
  )

  return NextResponse.json({ success: true, vehicleType, driversAdjusted: clamped })
}