import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { parseGps, readJson } from '@/lib/validate'
import { parseOrderInput, quoteFromBooking } from '@/lib/pricing'
import { getAcceptHazardous } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  // Each quote looks up the address on the map, which uses our Mapbox quota.
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'quote', maxAttempts: 40, windowMinutes: 10 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const input = parseOrderInput(body)
  const gps = parseGps(body)
  if (!input || !gps.ok) {
    return NextResponse.json({ error: 'Please choose at least one bin and check your order details' }, { status: 400 })
  }

  if (input?.hazardous && !(await getAcceptHazardous())) {
    return NextResponse.json(
      { error: "We can't collect hazardous waste yet (batteries, chemicals, paint, medical waste). Please keep it out of your bins." },
      { status: 400 }
    )
  }

    const result = await quoteFromBooking(auth.user.id, body, input, gps.lat, gps.lng)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const q = result.quote
  return NextResponse.json({
    price: q.price,
    ruleId: q.ruleId,
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
