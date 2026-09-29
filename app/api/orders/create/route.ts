import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { parseGps, readJson } from '@/lib/validate'
import { parseOrderInput, quoteFromBooking } from '@/lib/pricing'

const MAX_UNPAID_DRAFTS = 20

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'create_order', maxAttempts: 15, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
    const input = parseOrderInput(body)
  const gps = parseGps(body)

  if (!input || !gps.ok) {
    return NextResponse.json({ error: 'Please check your order details' }, { status: 400 })
  }

  const drafts = await prisma.order.count({ where: { customerId: user.id, status: 'DRAFT' } })
  if (drafts >= MAX_UNPAID_DRAFTS) {
    return NextResponse.json(
      { error: 'You have too many unpaid draft orders. Please delete some from My Orders first.' },
      { status: 400 }
    )
  }

  // The price, zone and shift are all worked out here on the server, never taken from the browser.
    const result = await quoteFromBooking(user.id, body, input, gps.lat, gps.lng)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      status: 'DRAFT',
      zoneId: result.quote.zoneId,
      latitude: result.lat,
      longitude: result.lng,
      quoteSnapshot: result.quote as unknown as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({
    id: order.id,
    price: result.quote.price,
    zoneName: result.quote.zoneName,
    collectionLabel: result.quote.collectionLabel,
  })
}
