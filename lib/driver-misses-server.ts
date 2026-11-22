// Drivers who accept stops and then don't collect them. Accepting holds the stop, so other drivers aren't offered it
// until the night ends and the customer loses a night. After the night, a driver with MISS_PAUSE_COUNT such stops in
// the last MISS_WINDOW_DAYS is paused (taken out of dispatch, like the ops "Pause" button) and ops are told, so
// someone talks to them before they work again. Ops resume them on the Drivers page.

import { prisma } from '@/lib/prisma'
import { notifyOps, notifyUser } from '@/lib/notify'
import { logAdminAction } from '@/lib/admin-log'

export const MISS_PAUSE_COUNT = 3 // placeholder
export const MISS_WINDOW_DAYS = 7
export const ACCEPTED_NOT_COLLECTED = 'Accepted but not collected by shift end' // the DriverMiss reason (lib/nightly-jobs.ts)

export async function pauseRepeatMissers(now: Date): Promise<number> {
  const since = new Date(now.getTime() - MISS_WINDOW_DAYS * 86_400_000)
  const rows = await prisma.driverMiss.groupBy({
    by: ['driverId'],
    where: { kind: 'NOT_COLLECTED', reason: ACCEPTED_NOT_COLLECTED, createdAt: { gte: since } },
    _count: { _all: true },
  })
  const over = (rows as { driverId: string; _count: { _all: number } }[]).filter((r) => r._count._all >= MISS_PAUSE_COUNT)
  let paused = 0
  for (const r of over) {
    const done = await prisma.driverProfile.updateMany({ where: { userId: r.driverId, isActive: true }, data: { isActive: false, isOnline: false } })
    if (done.count !== 1) continue // already paused
    paused++
    const u = await prisma.user.findUnique({ where: { id: r.driverId }, select: { name: true } })
    const why = `${r._count._all} accepted stops not collected in ${MISS_WINDOW_DAYS} days`
    await logAdminAction('system', 'DRIVER_AUTO_PAUSED', r.driverId, why)
    await notifyUser(r.driverId, {
      title: 'Your account is paused',
      body: `You accepted ${r._count._all} stops in the last ${MISS_WINDOW_DAYS} days and didn't collect them, so customers waited another night. Trashit will call you before you work again.`,
      url: '/dashboard/driver',
    })
    await notifyOps({
      title: `${u?.name ?? 'A driver'} was paused`,
      body: `${why}. Talk to them, then resume them on the Drivers page.`,
      url: '/ops/drivers',
    })
  }
  return paused
}
