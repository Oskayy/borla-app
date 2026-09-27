import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { vehicleType, vehiclePlate, zoneId, homeAddress, homeLat, homeLng } = await req.json()

  if (!vehicleType) {
    return NextResponse.json({ error: 'Vehicle type is required' }, { status: 400 })
  }

  await prisma.driverProfile.update({
    where: { userId: user.id },
    data: {
      vehicleType,
      vehiclePlate: vehiclePlate || null,
      zoneId: zoneId || null,
      homeAddress: homeAddress || null,
      homeLat: homeLat ?? null,
      homeLng: homeLng ?? null,
    },
  })

  return NextResponse.json({ success: true })
}