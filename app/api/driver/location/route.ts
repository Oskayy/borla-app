import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { lat, lng } = await req.json()

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 })
  }

  await prisma.driverProfile.update({
    where: { userId: user.id },
    data: {
      currentLat: lat,
      currentLng: lng,
      lastLocationAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}