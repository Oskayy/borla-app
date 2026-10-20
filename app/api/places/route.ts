import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { searchPlaces } from '@/lib/place-search'

// Suggestions for the home-pin search box: areas, streets and landmarks in Ghana. Signed-in customers and drivers
// only, and limited per person (the box waits for a pause in typing), so the free search service is used fairly.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER', 'DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'place_search', maxAttempts: 150, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const params = req.nextUrl.searchParams
  const q = (params.get('q') ?? '').slice(0, 120)
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const near = params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null

  const places = await searchPlaces(q, near)
  if (places === null) return NextResponse.json({ error: 'Place search is not answering just now. Move the map to your home and tap it instead.' }, { status: 503 })
  return NextResponse.json({ places }, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
