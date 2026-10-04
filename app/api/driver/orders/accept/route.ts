import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { caught } from '@/lib/errors'

const MAX_ORDERS = 60

// The driver accepts one or more assigned stops. Only accepted stops can be navigated to and collected.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'driver_accept', maxAttempts: 120, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderIds = body?.orderIds
  if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > MAX_ORDERS || !orderIds.every(isUuid)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const ids: string[] = Array.from(new Set(orderIds as string[]))

  const result = await prisma.$transaction(async (tx) => {
    const waiting = await tx.order.findMany({
      where: { id: { in: ids }, driverId: user.id, status: 'ASSIGNED', driverAcceptedAt: null },
      select: { id: true },
    })
    const waitingIds = waiting.map((o: { id: string }) => o.id)
    if (waitingIds.length === 0) return 0
    const accepted = await tx.order.updateMany({
      where: { id: { in: waitingIds }, driverId: user.id, status: 'ASSIGNED', driverAcceptedAt: null },
      data: { driverAcceptedAt: new Date() },
    })
    if (accepted.count !== waitingIds.length) throw new Error('STATE_CHANGED')
    await tx.auditLog.createMany({
      data: waitingIds.map((orderId: string) => ({
        orderId,
        actorId: user.id,
        fromState: 'ASSIGNED',
        toState: 'ASSIGNED',
        reason: 'Driver accepted the stop',
      })),
    })
    return accepted.count
  }).catch((err) => {
    if (caught(err)?.message === 'STATE_CHANGED') return -1
    throw err
  })
  if (result === -1) {
    return NextResponse.json({ error: 'Your stops just changed. Please refresh.' }, { status: 409 })
  }

  return NextResponse.json({ success: true, accepted: result })
}
