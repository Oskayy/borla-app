import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVIDENCE_BUCKET } from '@/lib/storage'
import {
  DRAFT_DAYS,
  FINISHED_STATUSES,
  NOTIFICATION_DAYS,
  OPEN_REFUND_STATUSES,
  PHOTO_MONTHS,
  PIN_MONTHS,
  RETENTION_BATCH,
  daysBefore,
  filesToRemove,
  monthsBefore,
} from '@/lib/retention'

export type RetentionCounts = { photos: number; files: number; pins: number; notifications: number; drafts: number }

// A finished order whose time is up, with nothing still open on it. updatedAt moves on with any later change,
// so the clock only starts once the order has truly settled.
function expiredOrder(before: Date): Prisma.OrderWhereInput {
  return {
    status: { in: [...FINISHED_STATUSES] },
    updatedAt: { lt: before },
    disputes: { none: { status: 'OPEN' } },
    refunds: { none: { status: { in: OPEN_REFUND_STATUSES } } },
  }
}

// Deletes personal data past its limit (lib/retention.ts). With dryRun it only counts.
export async function runRetention(now: Date, dryRun: boolean): Promise<RetentionCounts> {
  const photoWhere: Prisma.OrderEvidenceWhereInput = { order: expiredOrder(monthsBefore(now, PHOTO_MONTHS)) }
  const pinWhere: Prisma.OrderWhereInput = {
    ...expiredOrder(monthsBefore(now, PIN_MONTHS)),
    OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
  }
  const notificationWhere: Prisma.NotificationWhereInput = { createdAt: { lt: daysBefore(now, NOTIFICATION_DAYS) } }
  // Never-paid bookings with nothing money-related attached.
  const draftWhere: Prisma.OrderWhereInput = {
    status: 'DRAFT',
    createdAt: { lt: daysBefore(now, DRAFT_DAYS) },
    payments: { none: {} },
    ledgerEntries: { none: {} },
    refunds: { none: {} },
  }

  if (dryRun) {
    const [photos, pins, notifications, drafts] = await Promise.all([
      prisma.orderEvidence.count({ where: photoWhere }),
      prisma.order.count({ where: pinWhere }),
      prisma.notification.count({ where: notificationWhere }),
      prisma.order.count({ where: draftWhere }),
    ])
    return { photos, files: photos, pins, notifications, drafts }
  }

  // 1. Photos of old finished orders and of old drafts (rows first, then the files nobody else uses).
  const drafts = await prisma.order.findMany({ where: draftWhere, select: { id: true }, take: RETENTION_BATCH })
  const draftIds = drafts.map((d) => d.id)
  const evidence = await prisma.orderEvidence.findMany({
    where: { OR: [photoWhere, { orderId: { in: draftIds } }] },
    select: { id: true, photoUrl: true },
    take: RETENTION_BATCH,
  })
  const evidenceIds = evidence.map((e) => e.id)
  const paths = evidence.map((e) => e.photoUrl)
  const stillUsed = await prisma.orderEvidence.findMany({
    where: { photoUrl: { in: paths }, id: { notIn: evidenceIds } },
    select: { photoUrl: true },
  })
  const files = filesToRemove(paths, stillUsed.map((s) => s.photoUrl))

  // 2. Pins and addresses of old finished orders.
  const pinned = await prisma.order.findMany({ where: pinWhere, select: { id: true, quoteSnapshot: true }, take: RETENTION_BATCH })

  let notifications = 0
  await prisma.$transaction(
    async (tx) => {
      await tx.orderEvidence.deleteMany({ where: { id: { in: evidenceIds } } })
      for (const o of pinned) {
        const { address: _address, ...rest } = (o.quoteSnapshot ?? {}) as Record<string, unknown>
        await tx.order.update({
          where: { id: o.id },
          data: { latitude: null, longitude: null, quoteSnapshot: { ...rest, address: 'Removed (kept 12 months)' } as Prisma.InputJsonValue },
        })
      }
      if (draftIds.length > 0) {
        await tx.auditLog.deleteMany({ where: { orderId: { in: draftIds } } })
        await tx.order.deleteMany({ where: { id: { in: draftIds }, status: 'DRAFT' } })
      }
      notifications = (await tx.notification.deleteMany({ where: notificationWhere })).count
    },
    { timeout: 60000 }
  )

  // The rows are gone, so a failed file removal only leaves unreachable files; it is logged to remove by hand.
  if (files.length > 0) {
    const { error } = await createAdminClient().storage.from(EVIDENCE_BUCKET).remove(files)
    if (error) console.error('[retention] photo file removal failed; files to remove by hand:', files.length, error.message)
  }

  return { photos: evidenceIds.length, files: files.length, pins: pinned.length, notifications, drafts: draftIds.length }
}

export function retentionSummary(c: RetentionCounts): string {
  return `${c.photos} photo record(s) (${c.files} file(s)), ${c.pins} order pin(s), ${c.notifications} alert(s), ${c.drafts} unpaid draft(s)`
}
