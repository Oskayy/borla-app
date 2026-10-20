// A driver going offline during the shift with stops still to collect. Without this, those stops stayed on the
// driver's list and nobody collected them. Now: the driver is warned first (the Go offline button asks), then every
// stop they haven't collected is taken off their route and given straight to the next best online driver (the same
// path as a decline), and ops are told. Orders already collected stay with the driver: only they can unload them.

import { prisma } from '@/lib/prisma'
import { reassignOrder } from '@/lib/reassign-server'
import { notifyOps } from '@/lib/notify'
import { caught } from '@/lib/errors'

export const WENT_OFFLINE_REASON = 'Went offline during the shift'

// What going offline would affect: stops still to collect, and collected orders on board.
export async function openWork(driverId: string): Promise<{ toCollect: number; onBoard: number }> {
  const [toCollect, onBoard] = await Promise.all([
    prisma.order.count({ where: { driverId, status: 'ASSIGNED' } }),
    prisma.order.count({ where: { driverId, status: { in: ['PICKED_UP', 'DISPOSAL_PENDING'] } } }),
  ])
  return { toCollect, onBoard }
}

export async function releaseStopsOnOffline(driverId: string, driverName: string): Promise<{ released: number; reassigned: number; onBoard: number }> {
  const orders = await prisma.order.findMany({
    where: { driverId, status: 'ASSIGNED' },
    select: { id: true, shiftDate: true },
    orderBy: { createdAt: 'asc' },
  })

  const released: string[] = []
  for (const o of orders) {
    try {
      await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({
          where: { id: o.id, driverId, status: 'ASSIGNED' },
          data: { driverId: null, status: 'PAID', driverAcceptedAt: null, offeredAt: null },
        })
        if (r.count !== 1) throw new Error('STATE_CHANGED')
        await tx.routeStop.deleteMany({ where: { orderId: o.id } })
        // Not offered back to this driver tonight (declines are forgotten when an order rolls over).
        await tx.orderDecline.createMany({ data: [{ orderId: o.id, driverId, reason: WENT_OFFLINE_REASON }], skipDuplicates: true })
        await tx.auditLog.create({
          data: { orderId: o.id, actorId: driverId, fromState: 'ASSIGNED', toState: 'PAID', reason: `RELEASED: ${WENT_OFFLINE_REASON}` },
        })
      })
      released.push(o.id)
    } catch (err) {
      const e = caught(err)
      if (e?.message !== 'STATE_CHANGED') console.error('[offline] could not release order', o.id, e)
    }
  }

  // Straight to the next best online driver; anything nobody can take waits on the Assign page.
  let reassigned = 0
  for (const id of released) {
    try {
      const outcome = await reassignOrder(id, null)
      if (outcome.reassigned) reassigned++
    } catch (err) {
      console.error('[offline] reassign failed', id, caught(err))
    }
  }

  const onBoard = await prisma.order.count({ where: { driverId, status: { in: ['PICKED_UP', 'DISPOSAL_PENDING'] } } })
  if (released.length > 0 || onBoard > 0) {
    const stops = (n: number) => `${n} ${n === 1 ? 'stop' : 'stops'}`
    const waiting = released.length - reassigned
    await notifyOps({
      title: `${driverName} went offline${released.length ? ` with ${stops(released.length)}` : ''}`,
      body:
        (released.length
          ? `${reassigned} given to other drivers` + (waiting > 0 ? `, ${waiting} waiting for a driver on Plan & assign` : '') + '.'
          : 'No stops to collect.') +
        (onBoard > 0 ? ` ${onBoard} collected ${onBoard === 1 ? 'order is' : 'orders are'} still on board, not yet unloaded.` : ''),
      url: '/ops/assign',
    })
  }
  return { released: released.length, reassigned, onBoard }
}
