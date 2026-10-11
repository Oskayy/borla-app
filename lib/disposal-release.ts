import type { Prisma } from '@prisma/client'
import { ensureSplit } from '@/lib/order-split-server'
import { clearsAt, PICKUP_TYPE, shiftEndsAt, UNLOAD_TYPE } from '@/lib/earnings'
import type { ShiftSettings } from '@/lib/shift'

type Tx = Prisma.TransactionClient

// Who can approve or reject unloads that need a human check.
export const DISPOSAL_REVIEW_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'COMPLIANCE']

// Completes disposal for a set of orders inside a transaction: marks them COMPLETED, records the site visit,
// releases the driver's unload share of each order (from the split frozen at payment), and starts the clearing
// period for both shares of the order (lib/earnings.ts).
// The ledger's unique idempotency key (disposal-<orderId>) makes a double payout impossible.
export async function releaseDisposal(
  tx: Tx,
  args: {
    orders: { id: string; shiftDate: Date | null }[]
    fromStatus: 'PICKED_UP' | 'DISPOSAL_PENDING'
    driverId: string
    settings: ShiftSettings
    facilityId: string | null
    method: string // 'geofence' | 'ops_review' | 'driver_photo'
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

  const now = new Date()
  let total = 0
  for (const o of args.orders) {
    const split = await ensureSplit(tx, o.id)
    const clears = clearsAt(now, shiftEndsAt(o.shiftDate, args.settings))
    total += split.unload
    await tx.ledgerEntry.create({
      data: {
        orderId: o.id,
        type: UNLOAD_TYPE,
        amount: split.unload / 100,
        amountPesewas: split.unload,
        idempotencyKey: `disposal-${o.id}`,
        driverId: args.driverId,
        clearsAt: clears,
      },
    })
    // The pickup share was waiting for this unload: it clears at the same time.
    await tx.ledgerEntry.updateMany({
      where: { orderId: o.id, driverId: args.driverId, type: PICKUP_TYPE, clearsAt: null },
      data: { clearsAt: clears },
    })
    if (args.facilityId) {
      await tx.facilityVerification.create({ data: { orderId: o.id, facilityId: args.facilityId, method: args.method } })
    }
    await tx.auditLog.create({
      data: { orderId: o.id, actorId: args.actorId, fromState: args.fromStatus, toState: 'COMPLETED', reason: args.reason },
    })
  }
  return total / 100
}
