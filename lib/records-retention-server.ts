import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVIDENCE_BUCKET } from '@/lib/storage'
import { filesToRemove } from '@/lib/retention'
import { REMOVED, SETTLED_ORDER_STATUSES, SETTLED_WITHDRAWAL_STATUSES, yearRange } from '@/lib/records-retention'

const CHUNK = 500

export interface YearCounts {
  orders: number
  skippedOrders: number // not settled yet, left alone
  withdrawals: number
  staffLogs: number
}

export async function countYear(year: number): Promise<YearCounts> {
  const range = yearRange(year)
  const [orders, all, withdrawals, staffLogs] = await Promise.all([
    prisma.order.count({ where: { createdAt: range, status: { in: [...SETTLED_ORDER_STATUSES] } } }),
    prisma.order.count({ where: { createdAt: range, status: { not: 'DRAFT' } } }),
    prisma.withdrawal.count({ where: { requestedAt: range, status: { in: [...SETTLED_WITHDRAWAL_STATUSES] } } }),
    prisma.adminActionLog.count({ where: { createdAt: range } }),
  ])
  return { orders, skippedOrders: all - orders, withdrawals, staffLogs }
}

// Removes personal details from one year's settled records. Safe to run again: it only clears fields.
export async function anonymiseYear(year: number): Promise<YearCounts & { photos: number }> {
  const range = yearRange(year)
  let orders = 0
  let photos = 0
  let cursor: string | undefined

  for (;;) {
    const batch = await prisma.order.findMany({
      where: { createdAt: range, status: { in: [...SETTLED_ORDER_STATUSES] } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: CHUNK,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    const ids = batch.map((o) => o.id)

    // Photos should be gone after 12 months already; any left (kept for a complaint) go now.
    const evidence = await prisma.orderEvidence.findMany({ where: { orderId: { in: ids } }, select: { id: true, photoUrl: true } })
    const evidenceIds = evidence.map((e) => e.id)
    const paths = evidence.map((e) => e.photoUrl)
    const stillUsed = await prisma.orderEvidence.findMany({ where: { photoUrl: { in: paths }, id: { notIn: evidenceIds } }, select: { photoUrl: true } })
    const files = filesToRemove(paths, stillUsed.map((s) => s.photoUrl))

    await prisma.$transaction(
      async (tx) => {
        await tx.order.updateMany({ where: { id: { in: ids } }, data: { latitude: null, longitude: null, cancelReason: null } })
        await tx.$executeRaw`UPDATE "Order" SET "quoteSnapshot" = "quoteSnapshot" - 'address' WHERE "id" = ANY(${ids}) AND "quoteSnapshot" ? 'address'`
        await tx.orderEvidence.deleteMany({ where: { id: { in: evidenceIds } } })
        await tx.orderRating.updateMany({ where: { orderId: { in: ids } }, data: { comment: null } })
        await tx.dispute.updateMany({ where: { orderId: { in: ids } }, data: { reason: REMOVED, resolution: null } })
        await tx.refund.updateMany({ where: { orderId: { in: ids } }, data: { reason: REMOVED } })
        await tx.auditLog.updateMany({ where: { orderId: { in: ids } }, data: { reason: null } })
        await tx.driverMiss.updateMany({ where: { orderId: { in: ids } }, data: { reason: null } })
        await tx.orderDecline.updateMany({ where: { orderId: { in: ids } }, data: { reason: REMOVED } })
      },
      { timeout: 60000 }
    )
    if (files.length > 0) {
      const { error } = await createAdminClient().storage.from(EVIDENCE_BUCKET).remove(files)
      if (error) console.error('[records-retention] photo file removal failed; files to remove by hand:', files.length, error.message)
    }
    orders += ids.length
    photos += evidenceIds.length
  }

  const withdrawals = await prisma.withdrawal.updateMany({
    where: { requestedAt: range, status: { in: [...SETTLED_WITHDRAWAL_STATUSES] } },
    data: { momoNumber: REMOVED, momoName: REMOVED, note: null },
  })
  const staffLogs = await prisma.adminActionLog.updateMany({ where: { createdAt: range }, data: { detail: null } })
  const skippedOrders = await prisma.order.count({
    where: { createdAt: range, status: { notIn: ['DRAFT', ...SETTLED_ORDER_STATUSES] } },
  })

  return { orders, skippedOrders, withdrawals: withdrawals.count, staffLogs: staffLogs.count, photos }
}

export function describeCounts(c: YearCounts & { photos?: number }): string {
  const parts = [`${c.orders} order(s)`, `${c.withdrawals} payout(s)`, `${c.staffLogs} staff log entr${c.staffLogs === 1 ? 'y' : 'ies'}`]
  if (c.photos) parts.push(`${c.photos} leftover photo(s) deleted`)
  if (c.skippedOrders) parts.push(`${c.skippedOrders} unsettled order(s) left alone`)
  return parts.join(', ')
}
