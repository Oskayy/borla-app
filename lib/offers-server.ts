import { prisma } from '@/lib/prisma'
import { getAcceptMinutes, getShiftSettings } from '@/lib/settings'
import { offerDeadline, isOfferExpired } from '@/lib/offers'
import { reassignOrder } from '@/lib/reassign-server'
import { notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'

const BATCH = 50
const MIN_GAP_MS = 20_000 // don't sweep more often than this from one server

let lastSweep = 0
let running: Promise<number> | null = null

// Stops a driver didn't accept in time are taken off their list and given to the next best driver.
// Runs from the scheduled job, and also whenever drivers' phones check for updates, so it keeps working
// even if the schedule isn't set up. Returns how many stops were moved.
export async function sweepExpiredOffers(force = false): Promise<number> {
  const now = Date.now()
  if (!force && now - lastSweep < MIN_GAP_MS) return 0
  if (running) return running
  lastSweep = now
  running = doSweep().finally(() => {
    running = null
  })
  return running
}

async function doSweep(): Promise<number> {
  const [settings, acceptMinutes] = await Promise.all([getShiftSettings(), getAcceptMinutes()])
  const now = new Date()

  // Anything offered at least `acceptMinutes` ago might be overdue; the shift-start rule is checked below.
  const candidates = await prisma.order.findMany({
    where: {
      status: 'ASSIGNED',
      driverAcceptedAt: null,
      offeredAt: { not: null, lte: new Date(now.getTime() - acceptMinutes * 60_000) },
    },
    select: { id: true, driverId: true, offeredAt: true, shiftDate: true, quoteSnapshot: true },
    orderBy: { offeredAt: 'asc' },
    take: BATCH,
  })

  let moved = 0
  for (const o of candidates) {
    if (!o.driverId || !o.offeredAt) continue
    const deadline = offerDeadline(o.offeredAt, o.shiftDate, settings.shiftStartMinutes, settings.timezone, acceptMinutes)
    if (!isOfferExpired(deadline, now)) continue

    const driverId: string = o.driverId
    const reason = `No answer within ${acceptMinutes} min`
    try {
      await prisma.$transaction(async (tx) => {
        const released = await tx.order.updateMany({
          where: { id: o.id, driverId, status: 'ASSIGNED', driverAcceptedAt: null, offeredAt: o.offeredAt },
          data: { driverId: null, status: 'PAID', offeredAt: null },
        })
        if (released.count !== 1) throw new Error('STATE_CHANGED')
        await tx.routeStop.deleteMany({ where: { orderId: o.id } })
        await tx.orderDecline.createMany({ data: [{ orderId: o.id, driverId, reason }], skipDuplicates: true })
        await tx.driverMiss.create({ data: { driverId, orderId: o.id, kind: 'EXPIRED', reason, shiftDate: o.shiftDate } })
        await tx.auditLog.create({
          data: { orderId: o.id, actorId: null, fromState: 'ASSIGNED', toState: 'PAID', reason: `EXPIRED: ${reason}` },
        })
      })
    } catch (err) {
      const e = caught(err)
      if (e?.message !== 'STATE_CHANGED') console.error('[offers] could not expire order', o.id, e)
      continue // the driver answered, or someone else changed it, in the meantime
    }
    moved++

    const address = (o.quoteSnapshot as { address?: string } | null)?.address ?? 'a stop'
    await notifyUser(driverId, {
      title: 'Stop given to another driver',
      body: `You didn't accept ${address} within ${acceptMinutes} minutes, so it went to another driver.`,
      url: '/dashboard/driver',
    })
    await reassignOrder(o.id, null)
  }
  return moved
}
