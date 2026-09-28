import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { distanceInMeters } from '@/lib/geo'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  // Each call uses our Mapbox quota, so keep it tight.
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'find_zone', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const address = cleanText((await readJson(req))?.address, 200)
  if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 })

  let lat: number | null = null
  let lng: number | null = null

  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=GH&limit=1&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
      { signal: AbortSignal.timeout(6000) }
    )
    const geoData = await geoRes.json()
    const center = geoData?.features?.[0]?.center
    if (Array.isArray(center) && center.length === 2) {
      lng = center[0]
      lat = center[1]
    }
  } catch (e) {
    console.error('Geocoding failed:', e)
  }

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "Couldn't find that address. Try adding a nearby landmark, or pick your location directly on the map below." },
      { status: 400 }
    )
  }

  const zones = await prisma.zone.findMany({
    where: { active: true, centerLat: { not: null }, centerLng: { not: null } },
    select: { id: true, name: true, city: true, centerLat: true, centerLng: true, radiusKm: true },
  })

  let matchedZone: { id: string; name: string } | null = null
  let matchedDistance = Infinity
  let nearestZone: { id: string; name: string; distanceKm: number } | null = null

  for (const zone of zones) {
    const distanceKm = distanceInMeters(lat, lng, zone.centerLat!, zone.centerLng!) / 1000
    const label = `${zone.name} — ${zone.city}`

    if (!nearestZone || distanceKm < nearestZone.distanceKm) {
      nearestZone = { id: zone.id, name: label, distanceKm }
    }
    if (distanceKm <= zone.radiusKm && distanceKm < matchedDistance) {
      matchedZone = { id: zone.id, name: label }
      matchedDistance = distanceKm
    }
  }

  return NextResponse.json({
    lat,
    lng,
    matchedZone,
    nearestZone: nearestZone ? { ...nearestZone, distanceKm: Math.round(nearestZone.distanceKm * 10) / 10 } : null,
  })
}