import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { reassignOrder } from '@/lib/reassign-server'
import { caught } from '@/lib/errors'

// The driver turns down a stop they haven't collected yet. It comes off their route straight away and
// is given to the best other driver. That driver is never offered it again.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  // Tight limit: declining lots of work should be a conversation with ops.
  if (await enforceRateLimit({ identifier: user.id, action: 'driver_decline', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  const reason = cleanText(body?.reason, 200)
  if (!isUuid(orderId)) return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  if (!reason || reason.length < 3) {
    return NextResponse.json({ error: 'Please say why you are declining' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const released = await tx.order.updateMany({
        where: { id: orderId, driverId: user.id, status: 'ASSIGNED' },
        data: { driverId: null, status: 'PAID', driverAcceptedAt: null, offeredAt: null },
      })
      if (released.count !== 1) throw new Error('STATE_CHANGED')

      await tx.routeStop.deleteMany({ where: { orderId } })
      await tx.orderDecline.create({ data: { orderId, driverId: user.id, reason } })
      const night = await tx.order.findUnique({ where: { id: orderId }, select: { shiftDate: true } })
      await tx.driverMiss.create({ data: { driverId: user.id, orderId, kind: 'DECLINED', reason, shiftDate: night?.shiftDate ?? null } })
      await tx.auditLog.create({
        data: { orderId, actorId: user.id, fromState: 'ASSIGNED', toState: 'PAID', reason: `DECLINED by driver: ${reason}` },
      })
    })
  } catch (err) {
    const e = caught(err)
    if (e?.message === 'STATE_CHANGED' || e?.code === 'P2002') {
      return NextResponse.json({ error: 'This stop can no longer be declined. Please refresh.' }, { status: 409 })
    }
    console.error('[decline] failed:', e)
    return NextResponse.json({ error: 'Could not decline. Please try again.' }, { status: 500 })
  }

  // Straight to the next best driver. If nobody fits, ops see it on the Assign page.
  const outcome = await reassignOrder(orderId, user.id)
  return NextResponse.json({ success: true, reassigned: outcome.reassigned })
}
