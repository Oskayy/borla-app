import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVIDENCE_BUCKET } from '@/lib/storage'
import { DISPOSAL_REVIEW_ROLES } from '@/lib/disposal-release'
import DisposalReviewClient, { type ReviewGroup } from '@/components/DisposalReviewClient'

export const dynamic = 'force-dynamic'

export default async function DisposalReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !DISPOSAL_REVIEW_ROLES.includes(dbUser.role)) redirect('/ops')

  const pending = await prisma.order.findMany({
    where: { status: 'DISPOSAL_PENDING' },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
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
    const key = o.routeStop ? `${o.routeStop.routeId}-${o.routeStop.tripNumber}` : `order-${o.id}`
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
        driverName: o.driver?.name ?? 'Unknown driver',
        driverPhone: o.driver?.phone ?? '',
        siteName: trip?.facility?.name ?? null,
        why: o.auditLogs[0]?.reason.replace(/^DISPOSAL NEEDS REVIEW:\s*/, '') ?? 'Needs a check',
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
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Unloads to Check</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Most unloads are confirmed automatically when the driver&apos;s photo is taken inside the disposal site&apos;s
        geofence. These couldn&apos;t be checked automatically. Look at the photo: <strong>approve</strong> releases the
        driver&apos;s disposal share for every order in the load; <strong>reject</strong> sends the load back to the
        driver to confirm again.
      </p>
      <DisposalReviewClient groups={Array.from(groups.values())} />
    </div>
  )
}
