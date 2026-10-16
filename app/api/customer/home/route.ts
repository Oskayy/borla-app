import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isValidLat, isValidLng, readJson } from '@/lib/validate'
import { findZoneForPoint } from '@/lib/pricing'
import { LANDMARK_MAX } from '@/lib/home-address'

// Saves the customer's home: the place, a landmark drivers can spot at night, and the map pin. Used on every booking unless they choose another address.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'customer_home', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const address = cleanText(body?.address, 200)
  const landmark = cleanText(body?.landmark, LANDMARK_MAX)
  const lat = body?.lat
  const lng = body?.lng

  if (!address) return NextResponse.json({ error: 'Please enter your area or street' }, { status: 400 })
  if (!landmark || landmark.length < 3) {
    return NextResponse.json({ error: 'Please add a landmark drivers can find at night, e.g. blue gate opposite the church' }, { status: 400 })
  }
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return NextResponse.json({ error: 'Please place a pin on the map' }, { status: 400 })
  }
  if (body?.confirmed !== true) {
    return NextResponse.json({ error: 'Please confirm the pin is on your house or gate' }, { status: 400 })
  }

  // Saving is allowed outside our zones (people move), but we tell them booking won't work there yet.
  const zone = await findZoneForPoint(lat, lng)

  await prisma.customerProfile.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, address, homeLandmark: landmark, homeLat: lat, homeLng: lng, zoneId: zone?.id ?? null, homeUpdatedAt: new Date(), homePinConfirmedAt: new Date() },
    update: { address, homeLandmark: landmark, homeLat: lat, homeLng: lng, zoneId: zone?.id ?? null, homeUpdatedAt: new Date(), homePinConfirmedAt: new Date() },
  })

  return NextResponse.json({ success: true, zoneName: zone?.name ?? null })
}
