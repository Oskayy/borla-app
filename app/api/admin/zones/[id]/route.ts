import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

async function requireOpsRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) return null

  return dbUser
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await requireOpsRole()
  if (!dbUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { id } = await params
  const { name, city, centerLat, centerLng, radiusKm, coveredAreas, active } = await req.json()

  const areasArray: string[] | undefined = coveredAreas !== undefined
    ? (Array.isArray(coveredAreas)
        ? coveredAreas
        : (coveredAreas || '')
            .split(',')
            .map((a: string) => a.trim())
            .filter((a: string) => a.length > 0))
    : undefined

  const zone = await prisma.zone.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(centerLat !== undefined ? { centerLat: centerLat != null && centerLat !== '' ? Number(centerLat) : null } : {}),
      ...(centerLng !== undefined ? { centerLng: centerLng != null && centerLng !== '' ? Number(centerLng) : null } : {}),
      ...(radiusKm !== undefined ? { radiusKm: radiusKm != null && radiusKm !== '' ? Number(radiusKm) : 3 } : {}),
      ...(areasArray !== undefined ? { coveredAreas: areasArray } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  })

  return NextResponse.json({ success: true, zone })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await requireOpsRole()
  if (!dbUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { id } = await params

  const driverCount = await prisma.driverProfile.count({ where: { zoneId: id } })
  const customerCount = await prisma.customerProfile.count({ where: { zoneId: id } })

  if (driverCount > 0 || customerCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${driverCount} driver(s) and ${customerCount} customer(s) are still assigned to this zone. Reassign them first, or deactivate the zone instead.` },
      { status: 400 }
    )
  }

  await prisma.zone.delete({ where: { id } })

  return NextResponse.json({ success: true })
}