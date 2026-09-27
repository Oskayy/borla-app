import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { distanceInMeters } from '@/lib/geo'

export async function POST(req: NextRequest) {
  const { address } = await req.json()

  if (!address || !address.trim()) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  let lat: number | null = null
  let lng: number | null = null

  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=GH&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    )
    const geoData = await geoRes.json()
    if (geoData.features && geoData.features.length > 0) {
      ;[lng, lat] = geoData.features[0].center
    }
  } catch (e) {
    console.error('Geocoding failed:', e)
  }

  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Couldn't find that address. Try adding a nearby landmark, or pick your location directly on the map below." }, { status: 400 })
  }

  const zones = await prisma.zone.findMany({
    where: { active: true, centerLat: { not: null }, centerLng: { not: null } },
    select: { id: true, name: true, city: true, centerLat: true, centerLng: true, radiusKm: true },
  })

  let matchedZone: { id: string; name: string } | null = null
  let nearestZone: { id: string; name: string; distanceKm: number } | null = null

  for (const zone of zones) {
    const distanceKm = distanceInMeters(lat, lng, zone.centerLat!, zone.centerLng!) / 1000

    if (!nearestZone || distanceKm < nearestZone.distanceKm) {
      nearestZone = { id: zone.id, name: `${zone.name} — ${zone.city}`, distanceKm }
    }

    if (distanceKm <= zone.radiusKm && (!matchedZone || distanceKm < (nearestZone?.distanceKm ?? Infinity))) {
      matchedZone = { id: zone.id, name: `${zone.name} — ${zone.city}` }
    }
  }

  return NextResponse.json({
    lat,
    lng,
    matchedZone,
    nearestZone: nearestZone ? { ...nearestZone, distanceKm: Math.round(nearestZone.distanceKm * 10) / 10 } : null,
  })
}