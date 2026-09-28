import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, parseGps, readJson } from '@/lib/validate'
import { computeQuote, parseOrderInput } from '@/lib/pricing'

const MAX_UNPAID_DRAFTS = 20

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'create_order', maxAttempts: 15, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const address = cleanText(body?.address, 200)
  const input = parseOrderInput(body)
  const gps = parseGps(body)

  if (!address || !input || !gps.ok) {
    return NextResponse.json({ error: 'Please check your address and order details' }, { status: 400 })
  }

  const drafts = await prisma.order.count({ where: { customerId: user.id, status: 'DRAFT' } })
  if (drafts >= MAX_UNPAID_DRAFTS) {
    return NextResponse.json(
      { error: 'You have too many unpaid draft orders. Please delete some from My Orders first.' },
      { status: 400 }
    )
  }

  // The price is calculated here, never taken from the browser.
  const quote = await computeQuote(input)
  if (!quote) return NextResponse.json({ error: 'No active pricing rule found' }, { status: 500 })

  let latitude: number | null = null
  let longitude: number | null = null

  try {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=GH&limit=1&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
      { signal: AbortSignal.timeout(6000) }
    )
    const geoData = await geoRes.json()
    const center = geoData?.features?.[0]?.center
    if (Array.isArray(center) && center.length === 2) {
      longitude = center[0]
      latitude = center[1]
    }
  } catch (e) {
    console.error('Geocoding failed:', e)
  }

  // Fall back to the photo's GPS if the address text could not be located.
  if ((latitude == null || longitude == null) && gps.lat != null && gps.lng != null) {
    latitude = gps.lat
    longitude = gps.lng
  }

  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      status: 'DRAFT',
      latitude,
      longitude,
      quoteSnapshot: {
        address,
        wasteType: input.wasteType,
        bagCount: input.bagCount,
        price: quote.price,
        ruleId: quote.ruleId,
      },
    },
  })

  return NextResponse.json({ id: order.id, price: quote.price })
}