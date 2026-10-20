// A fingerprint of what the ops console shows, so open ops pages can refresh themselves when something changes
// (an order is paid, assigned, collected or unloaded; a driver goes online or offline; a refund, withdrawal,
// rating, dispute or approval comes in). Only a short hash leaves the server, never the data itself. A handful of
// small aggregate queries, cheap enough to ask every 15 seconds.

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export async function opsFingerprint(): Promise<string> {
  const [orders, refunds, withdrawals, withdrawalStates, online, approvals, ratings, disputes, routes] = await Promise.all([
    prisma.order.aggregate({ _max: { updatedAt: true }, _count: { _all: true } }),
    prisma.refund.aggregate({ _max: { updatedAt: true }, _count: { _all: true } }),
    prisma.withdrawal.aggregate({ _max: { requestedAt: true, reviewedAt: true, markedPaidAt: true, paidAt: true } }),
    prisma.withdrawal.groupBy({ by: ['status'], _count: { _all: true } }),
    // Who is online (not where they are: positions change every few seconds and would refresh pages for nothing).
    prisma.driverProfile.findMany({ where: { isOnline: true }, select: { userId: true }, orderBy: { userId: 'asc' } }),
    prisma.driverProfile.groupBy({ by: ['approvalStatus'], _count: { _all: true } }),
    prisma.orderRating.aggregate({ _max: { createdAt: true }, _count: { _all: true } }),
    prisma.dispute.aggregate({ _max: { createdAt: true }, _count: { _all: true } }),
    prisma.route.aggregate({ _max: { createdAt: true }, _count: { _all: true } }),
  ])
  const state = JSON.stringify([
    orders._max.updatedAt,
    orders._count._all,
    refunds._max.updatedAt,
    refunds._count._all,
    withdrawals._max,
    withdrawalStates.map((w) => [w.status, w._count._all]).sort(),
    online.map((d) => d.userId),
    approvals.map((a) => [a.approvalStatus, a._count._all]).sort(),
    ratings._max.createdAt,
    ratings._count._all,
    disputes._max.createdAt,
    disputes._count._all,
    routes._max.createdAt,
    routes._count._all,
  ])
  return createHash('sha256').update(state).digest('hex').slice(0, 16)
}
