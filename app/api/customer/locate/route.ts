import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { geocodeAddress } from '@/lib/geocode'
import { findZoneForPoint } from '@/lib/pricing'

// Finds a typed address on the map so the customer can check the pin before saving it.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  // Each lookup uses our Mapbox quota, so keep it tight.
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'customer_locate', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const address = cleanText((await readJson(req))?.address, 200)
  if (!address) return NextResponse.json({ error: 'Please enter your address' }, { status: 400 })

  const point = await geocodeAddress(address)
  if (!point) {
    return NextResponse.json(
      { error: "We couldn't find that address. Try adding a nearby landmark, or tap your home on the map instead." },
      { status: 400 }
    )
  }

  const zone = await findZoneForPoint(point.lat, point.lng)
  return NextResponse.json({ lat: point.lat, lng: point.lng, zoneName: zone?.name ?? null })
}