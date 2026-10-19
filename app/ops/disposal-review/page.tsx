import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVIDENCE_BUCKET } from '@/lib/storage'
import { DISPOSAL_REVIEW_ROLES } from '@/lib/disposal-release'
import DisposalReviewClient, { type ReviewGroup } from '@/components/DisposalReviewClient'
import { PageHeader } from '@/components/ui'
import { getShiftSettings } from '@/lib/settings'
import { shiftEndsAt } from '@/lib/earnings'
import { REFUND_ROLES } from '@/lib/refunds'
import { dateLabel } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Orders whose night has ended (reads the clock: outside the component).
function nightOver(orders: { id: string; shiftDate: Date | null }[], settings: Awaited<ReturnType<typeof getShiftSettings>>): string[] {
  const now = Date.now()
  return orders.filter((o) => (shiftEndsAt(o.shiftDate, settings)?.getTime() ?? Infinity) <= now).map((o) => o.id)
}

export default async function DisposalReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !DISPOSAL_REVIEW_ROLES.includes(dbUser.role)) redirect('/ops')

  const settings = await getShiftSettings()
  const onBoard = await prisma.order.findMany({
    where: { status: 'PICKED_UP' },
    orderBy: { updatedAt: 'asc' },
    select: { id: true, shiftDate: true },
  })
  // Collected, and the night is over, but nobody confirmed the unload: the pickup share can't clear.
  const stale = new Set(nightOver(onBoard, settings))

  const pending = await prisma.order.findMany({
    where: { OR: [{ status: 'DISPOSAL_PENDING' }, { id: { in: Array.from(stale) } }] },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      status: true,
      shiftDate: true,
      quoteSnapshot: true,
      updatedAt: true,
      driver: { select: { id: true, name: true, phone: true } },
      routeStop: { select: { routeId: true, tripNumber: true } },
      evidence: { where: { type: 'driver_disposal' }, orderBy: { createdAt: 'desc' }, take: 1 },
      auditLogs: {
        where: { reason: { startsWith: 'DISPOSAL NEEDS REVIEW' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { reason: true },
      },
    },
  })

  // The planned site for each trip.
  const tripKeyMap = new Map<string, { routeId: string; tripNumber: number }>()
  for (const o of pending) {
    if (o.routeStop) tripKeyMap.set(`${o.routeStop.routeId}-${o.routeStop.tripNumber}`, o.routeStop)
  }
  const tripKeys = Array.from(tripKeyMap.values())
  const trips = tripKeys.length
    ? await prisma.routeTrip.findMany({
        where: { OR: tripKeys.map((k) => ({ routeId: k.routeId, tripNumber: k.tripNumber })) },
        include: { facility: { select: { name: true } } },
      })
    : []

  // Group orders unloaded together (same driver, same trip).
  const groups = new Map<string, ReviewGroup>()
  const admin = createAdminClient()
  for (const o of pending) {
    const kind = o.status === 'PICKED_UP' ? ('never_unloaded' as const) : ('review' as const)
    const key = `${kind}-${o.routeStop ? `${o.routeStop.routeId}-${o.routeStop.tripNumber}` : `order-${o.id}`}`
    let g = groups.get(key)
    if (!g) {
      const trip = o.routeStop ? trips.find((t) => t.routeId === o.routeStop!.routeId && t.tripNumber === o.routeStop!.tripNumber) : null
      const photoPath = o.evidence[0]?.photoUrl ?? null
      // The photo bucket is private: a short-lived link lets ops view it.
      const photoUrl = photoPath
        ? (await admin.storage.from(EVIDENCE_BUCKET).createSignedUrl(photoPath, 60 * 30)).data?.signedUrl ?? null
        : null
      g = {
        key,
        kind,
        driverName: o.driver?.name ?? 'Unknown driver',
        driverPhone: o.driver?.phone ?? '',
        siteName: trip?.facility?.name ?? null,
        why:
          kind === 'never_unloaded'
            ? `Collected on the night of ${o.shiftDate ? dateLabel(o.shiftDate) : 'an earlier night'}, but the unload was never confirmed. The driver's pickup share can't be paid until you decide.`
            : o.auditLogs[0]?.reason.replace(/^DISPOSAL NEEDS REVIEW:\s*/, '') ?? 'Needs a check',
        photoUrl,
        submittedAt: o.updatedAt.toISOString(),
        orders: [],
      }
      groups.set(key, g)
    }
    const q = o.quoteSnapshot as { address?: string; totalLitres?: number } | null
    g.orders.push({ id: o.id, address: q?.address ?? 'No address', litres: q?.totalLitres ?? null })
  }

  return (
    <div>
      <PageHeader
        title="Unloads to check"
        lead="Most unloads are confirmed automatically when the driver's photo is taken inside the site's geofence. These couldn't be, or were never confirmed at all. Approving releases the driver's unload share for every order in the load; sending back asks the driver to confirm again."
      />
      <DisposalReviewClient groups={Array.from(groups.values())} canRefund={REFUND_ROLES.includes(dbUser.role)} />
    </div>
  )
}
