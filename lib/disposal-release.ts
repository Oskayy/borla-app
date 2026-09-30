import type { Prisma } from '@prisma/client'
import { driverPoolFromSnapshot } from '@/lib/pricing-core'

type Tx = Prisma.TransactionClient

// Who can approve or reject unloads that need a human check.
export const DISPOSAL_REVIEW_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'COMPLIANCE']

// Completes disposal for a set of orders inside a transaction: marks them COMPLETED,
// records the site visit, and releases the driver's disposal share (e.g. 60%) of each order.
// The ledger's unique idempotency key (disposal-<orderId>) makes a double payout impossible.
export async function releaseDisposal(
  tx: Tx,
  args: {
    orders: { id: string; status: string; quoteSnapshot: unknown }[]
    fromStatus: 'PICKED_UP' | 'DISPOSAL_PENDING'
    driverId: string
    disposalPercent: number
    facilityId: string | null
    method: string // 'geofence' | 'ops_review'
    actorId: string
    reason: string
  }
): Promise<number> {
  const ids = args.orders.map((o) => o.id)
  const moved = await tx.order.updateMany({
    where: { id: { in: ids }, driverId: args.driverId, status: args.fromStatus },
    data: { status: 'COMPLETED' },
  })
  if (moved.count !== ids.length) throw new Error('STATE_CHANGED')

  let total = 0
  for (const o of args.orders) {
    const pool = driverPoolFromSnapshot(o.quoteSnapshot)
    if (pool === null) throw new Error('BAD_PRICE')
    const amount = Math.round(pool * args.disposalPercent) / 100
    total += amount
    await tx.ledgerEntry.create({
      data: { orderId: o.id, type: 'driver_payout_disposal', amount, idempotencyKey: `disposal-${o.id}`, driverId: args.driverId },
    })
    if (args.facilityId) {
      await tx.facilityVerification.create({ data: { orderId: o.id, facilityId: args.facilityId, method: args.method } })
    }
    await tx.auditLog.create({
      data: { orderId: o.id, actorId: args.actorId, fromState: args.fromStatus, toState: 'COMPLETED', reason: args.reason },
    })
  }
  return Math.round(total * 100) / 100
}
