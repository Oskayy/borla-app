import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { address, wasteType, bagCount, price, ruleId, gpsLat, gpsLng } = await req.json()

  if (!address || !address.trim()) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

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
    console.error('Geocoding failed:', e)
  }

  // If the address text couldn't be geocoded, fall back to the GPS
  // captured from the customer's placement photo, if we have it.
  // This is less precise than a good address, but far better than
  // having no coordinates at all (which blocks route assignment).
  if ((latitude == null || longitude == null) && gpsLat != null && gpsLng != null) {
    latitude = gpsLat
    longitude = gpsLng
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