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

export async function GET() {
  const dbUser = await requireOpsRole()
  if (!dbUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const zones = await prisma.zone.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ zones })
}

export async function POST(req: NextRequest) {
  const dbUser = await requireOpsRole()
  if (!dbUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { name, city, centerLat, centerLng, radiusKm, coveredAreas } = await req.json()

  if (!name || !city) {
    return NextResponse.json({ error: 'Name and city are required' }, { status: 400 })
  }

  const areasArray: string[] = Array.isArray(coveredAreas)
    ? coveredAreas
    : (coveredAreas || '')
        .split(',')
        .map((a: string) => a.trim())
        .filter((a: string) => a.length > 0)

  const zone = await prisma.zone.create({
    data: {
      name,
      city,
      centerLat: centerLat != null && centerLat !== '' ? Number(centerLat) : null,
      centerLng: centerLng != null && centerLng !== '' ? Number(centerLng) : null,
      radiusKm: radiusKm != null && radiusKm !== '' ? Number(radiusKm) : 3,
      coveredAreas: areasArray,
    },
  })

  return NextResponse.json({ success: true, zone })
}