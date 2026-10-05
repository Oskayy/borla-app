import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { canRate, parseRating } from '@/lib/ratings'
import { notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'

// The customer rates a collected pickup: 1-5 stars and an optional comment. One rating per order, final once sent.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'order_rating', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  const parsed = parseRating(await readJson(req))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      customerId: true,
      driverId: true,
      status: true,
      ledgerEntries: { where: { type: 'driver_payout_pickup' }, select: { createdAt: true }, take: 1 },
    },
  })
  if (!order || order.customerId !== auth.user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!canRate(order, order.ledgerEntries[0]?.createdAt ?? null, new Date())) {
    return NextResponse.json({ error: 'This pickup can no longer be rated' }, { status: 409 })
  }

  try {
    await prisma.orderRating.create({
      data: { orderId: id, driverId: order.driverId!, customerId: auth.user.id, stars: parsed.stars, comment: parsed.comment },
    })
  } catch (err) {
    if (caught(err)?.code === 'P2002') return NextResponse.json({ error: 'You have already rated this pickup' }, { status: 409 })
    throw err
  }

  // The driver hears the stars, never who sent them.
  await notifyUser(order.driverId!, {
    title: `New rating: ${parsed.stars} ${parsed.stars === 1 ? 'star' : 'stars'}`,
    body: parsed.comment ? `"${parsed.comment.slice(0, 120)}"` : 'A customer rated a recent pickup.',
    url: '/dashboard/driver/performance',
  }).catch((e) => console.error('[rating] notify failed', e))

  return NextResponse.json({ ok: true })
}
