// What is waiting for ops: the counts behind the menu badges and the Overview "needs attention" list.
// The conditions match the pages they link to, so a badge and its page always agree.

import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PICKUP_CHECK_MARKER } from '@/lib/plausibility'
import { OPEN_WITHDRAWAL_STATUSES } from '@/lib/wallet'
import { LOW_RATING } from '@/lib/ratings'
import { getShiftSettings } from '@/lib/settings'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { OPS_SECTIONS, canOpen, type QueueKey } from '@/lib/ops-nav'

const PICKUP_CHECK_REASONS: Prisma.AuditLogWhereInput[] = [{ reason: { contains: 'GPS MISMATCH' } }, { reason: { contains: PICKUP_CHECK_MARKER } }]
const PAYMENT_PROBLEM_REASONS: Prisma.AuditLogWhereInput[] = [
  { reason: { startsWith: 'PAYMENT AMOUNT MISMATCH' } },
  { reason: { startsWith: 'DUPLICATE OR LATE PAYMENT' } },
]

// The three kinds of exception on the Exceptions page.
export const EXCEPTION_WHERE = {
  flagged: { status: { in: ['FAILED_PICKUP', 'DISPUTED'] } } satisfies Prisma.OrderWhereInput,
  pickupChecks: {
    auditLogs: { some: { OR: PICKUP_CHECK_REASONS }, none: { reason: { startsWith: 'GPS REVIEWED' } } },
  } satisfies Prisma.OrderWhereInput,
  payments: {
    auditLogs: { some: { OR: PAYMENT_PROBLEM_REASONS }, none: { reason: { startsWith: 'PAYMENT PROBLEM RESOLVED' } } },
  } satisfies Prisma.OrderWhereInput,
}
export { PICKUP_CHECK_REASONS, PAYMENT_PROBLEM_REASONS }

export type QueueCounts = Record<QueueKey, number>

// Every count in one database round trip (the database is remote, so ten separate counts took seconds, and running
// them side by side used up the connection pool). The conditions must stay the same as EXCEPTION_WHERE and the pages
// the menu links to; change both together.
async function loadQueueCounts(role: string): Promise<QueueCounts> {
  const allowed = new Set(
    OPS_SECTIONS.flatMap((s) => s.links)
      .filter((l) => l.queue && canOpen(l, role))
      .map((l) => l.queue as QueueKey)
  )
  const counts: QueueCounts = { unloads: 0, exceptions: 0, approvals: 0, lowRatings: 0, withdrawals: 0, needsDriver: 0 }
  if (allowed.size === 0) return counts

  const night = dbDate(planningShiftDate(new Date(), await getShiftSettings()))
  const [row] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT
      (SELECT count(*) FROM "Order" WHERE status = 'PAID' AND "driverId" IS NULL AND ("shiftDate" <= ${night} OR "shiftDate" IS NULL)) AS "needsDriver",
      (SELECT count(*) FROM "Order" WHERE status = 'DISPOSAL_PENDING') AS "unloads",
      (SELECT count(*) FROM "Order" WHERE status IN ('FAILED_PICKUP', 'DISPUTED')) AS "flagged",
      (SELECT count(*) FROM "Order" o
        WHERE EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."orderId" = o.id AND (strpos(a.reason, 'GPS MISMATCH') > 0 OR strpos(a.reason, ${PICKUP_CHECK_MARKER}) > 0))
          AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."orderId" = o.id AND a.reason LIKE 'GPS REVIEWED%')) AS "checks",
      (SELECT count(*) FROM "Order" o
        WHERE EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."orderId" = o.id AND (a.reason LIKE 'PAYMENT AMOUNT MISMATCH%' OR a.reason LIKE 'DUPLICATE OR LATE PAYMENT%'))
          AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."orderId" = o.id AND a.reason LIKE 'PAYMENT PROBLEM RESOLVED%')) AS "payments",
      (SELECT count(*) FROM "DriverProfile" WHERE "approvalStatus" = 'PENDING' AND "submittedAt" IS NOT NULL) AS "approvals",
      (SELECT count(*) FROM "DriverProfile" WHERE "pendingVehicleAt" IS NOT NULL) AS "vehicleChanges",
      (SELECT count(*) FROM "OrderRating" WHERE stars <= ${LOW_RATING} AND "reviewedAt" IS NULL) AS "lowRatings",
      (SELECT count(*) FROM "Withdrawal" WHERE status = ANY(${OPEN_WITHDRAWAL_STATUSES})) AS "withdrawals"
  `
  const n = (k: string) => Number(row?.[k] ?? 0)
  const all: QueueCounts = {
    needsDriver: n('needsDriver'),
    unloads: n('unloads'),
    exceptions: n('flagged') + n('checks') + n('payments'),
    approvals: n('approvals') + n('vehicleChanges'),
    lowRatings: n('lowRatings'),
    withdrawals: n('withdrawals'),
  }
  for (const key of allowed) counts[key] = all[key]
  return counts
}

// Once per request: the ops layout (menu badges) and the Overview page share the result.
export const queueCounts = cache(loadQueueCounts)
