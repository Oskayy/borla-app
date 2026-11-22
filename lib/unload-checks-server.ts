import { prisma } from '@/lib/prisma'

// A driver whose unloads can be trusted a little further from the site (lib/unload-checks.ts), so ops review fewer
// of them at night: at least CLEAN_MIN_COMPLETED completed orders, and in the last CLEAN_WINDOW_DAYS no refund with
// them at fault, no unload sent back by ops, and nothing open against them now.
export const CLEAN_MIN_COMPLETED = 20 // placeholder
export const CLEAN_WINDOW_DAYS = 30

export async function hasCleanRecord(driverId: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - CLEAN_WINDOW_DAYS * 86_400_000)
  const [completed, faults, rejected, open] = await Promise.all([
    prisma.order.count({ where: { driverId, status: 'COMPLETED' } }),
    prisma.refund.count({ where: { driverFault: true, createdAt: { gte: since }, order: { driverId } } }),
    prisma.auditLog.count({ where: { actorId: { not: driverId }, reason: { startsWith: 'Unload photo rejected by ops' }, createdAt: { gte: since }, order: { driverId } } }),
    prisma.dispute.count({ where: { status: 'OPEN', order: { driverId } } }),
  ])
  return completed >= CLEAN_MIN_COMPLETED && faults === 0 && rejected === 0 && open === 0
}
