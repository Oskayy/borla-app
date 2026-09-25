import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { address, wasteType, bagCount, price, ruleId } = await req.json()

  // Convert the address text into real map coordinates
  let latitude: number | null = null
  let longitude: number | null = null

  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=GH&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    )
    const geoData = await geoRes.json()
    if (geoData.features && geoData.features.length > 0) {
      [longitude, latitude] = geoData.features[0].center
    }
  } catch (e) {
    // If geocoding fails, we still create the order — just without coordinates for now
    console.error('Geocoding failed:', e)
  }

  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      status: 'DRAFT',
      latitude,
      longitude,
      quoteSnapshot: { address, wasteType, bagCount, price, ruleId },
    },
  })

  return NextResponse.json(order)
}