import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { parseVehicleBody, slugify, VEHICLE_EDIT_ROLES } from '@/lib/vehicles'

export async function GET() {
  const auth = await requireAuth([...OPS_ROLES, 'FINANCE'])
  if (!auth.ok) return auth.response

  const vehicleTypes = await prisma.vehicleType.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ vehicleTypes })
}

// Adds a new kind of vehicle.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(VEHICLE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'vehicle_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const parsed = parseVehicleBody(await readJson(req))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.data

  const code = slugify(v.name)
  if (!code) return NextResponse.json({ error: 'Please use letters or numbers in the name' }, { status: 400 })

  const last = await prisma.vehicleType.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })

  try {
    const vehicleType = await prisma.vehicleType.create({
      data: { ...v, code, sortOrder: (last?.sortOrder ?? 0) + 1 },
    })
    await logAdminAction(
      auth.user.id,
      'VEHICLE_TYPE_CREATED',
      vehicleType.id,
      `"${v.name}": ${v.capacityLitres} L, radius ${v.defaultRadiusKm} km (max ${v.maxRadiusKm} km)`
    )
    return NextResponse.json({ success: true, vehicleType })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'A vehicle with that name already exists' }, { status: 400 })
    console.error('[vehicle-types] create failed:', e)
    return NextResponse.json({ error: 'Could not add the vehicle' }, { status: 500 })
  }
}