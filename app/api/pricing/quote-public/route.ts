import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isValidLat, isValidLng, readJson } from '@/lib/validate'
import { parseOrderInput, quoteAtPoint } from '@/lib/pricing'
import { getAcceptHazardous } from '@/lib/settings'

// Prices a pickup for someone who hasn't made an account yet, so they can see the price and collection night
// before signing up. Nothing is saved. Limited per IP address. The real price is worked out again on booking.
export async function POST(req: NextRequest) {
  if (await enforceRateLimit({ identifier: getClientIp(req), action: 'quote_public', maxAttempts: 20, windowMinutes: 10 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const input = parseOrderInput(body)
  if (!input) return NextResponse.json({ error: 'Please choose at least one bin' }, { status: 400 })
  if (input.hazardous && !(await getAcceptHazardous())) {
    return NextResponse.json(
      { error: "We can't collect hazardous waste yet (batteries, chemicals, paint, medical waste). Please keep it out of your bins." },
      { status: 400 }
    )
  }
  const address = cleanText(body?.address, 200)
  if (!address) return NextResponse.json({ error: 'Please describe the pickup place, with a landmark' }, { status: 400 })
  if (!isValidLat(body?.pinLat) || !isValidLng(body?.pinLng)) {
    return NextResponse.json({ error: 'Please place the pin on the pickup spot on the map' }, { status: 400 })
  }

  const result = await quoteAtPoint(input, address, { lat: body.pinLat, lng: body.pinLng }, 'pin')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const q = result.quote
  return NextResponse.json({
    price: q.price,
    zoneName: q.zoneName,
    address: q.address,
    lines: q.lines,
    totalBins: q.totalBins,
    totalLitres: q.totalLitres,
    recyclableDiscount: q.recyclableDiscount,
    hazardSurcharge: q.hazardSurcharge,
    lateSurcharge: q.lateSurcharge,
    isLate: q.isLate,
    collectionLabel: q.collectionLabel,
    taxLines: q.taxLines ?? [],
  })
}
