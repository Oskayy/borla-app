import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OPS_ROLES } from '@/lib/auth'
import { getShiftSettings } from '@/lib/settings'
import { hasActiveOverride, isDriverAvailable, isWithinShift, windowLabel } from '@/lib/shift'
import DriversClient from '@/components/DriversClient'
import { PageHeader } from '@/components/ui'
import { APPROVAL_ROLES, DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import { maskGhanaCard } from '@/lib/ghana-card'
import { createAdminClient } from '@/lib/supabase-admin'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { weeklyAverages } from '@/lib/ops-stats'
import { Kpi } from '@/components/ops/kit'

export const dynamic = 'force-dynamic'

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !OPS_ROLES.includes(dbUser.role)) redirect('/ops')

  const [drivers, settings] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'DRIVER' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        driverProfile: {
          select: {
            isActive: true,
            isOnline: true,
            wentOnlineAt: true,
            onlineOverrideUntil: true,
            radiusKm: true,
            homeLat: true,
            lastLocationAt: true,
            vehicleTypeRef: { select: { name: true, capacityLitres: true } },
            zone: { select: { name: true } },
            ghanaCardNumber: true,
          },
        },
        // Card photos uploaded before the number was asked for (to copy the number from).
        driverDocuments: { where: { type: 'ghana_card' }, select: { path: true }, take: 1 },
      },
    }),
    getShiftSettings(),
  ])

  // Only the staff who approve drivers see Ghana Card details.
  const canEditId = APPROVAL_ROLES.includes(dbUser.role)
  const cardPhotos = new Map<string, string>()
  if (canEditId) {
    const storage = createAdminClient().storage.from(DRIVER_DOCS_BUCKET)
    for (const d of drivers) {
      const path = d.driverDocuments[0]?.path
      if (!path) continue
      const url = (await storage.createSignedUrl(path, 60 * 30)).data?.signedUrl
      if (url) cardPhotos.set(d.id, url)
    }
  }

  const now = new Date()
  const night = planningShiftDate(now, settings)
  const since = new Date(now.getTime() - 35 * 86_400_000)
  const since30 = new Date(now.getTime() - 30 * 86_400_000)
  const ids = drivers.map((d) => d.id)
  // Tonight's stops, ratings over five weeks and missed stops over 30 days, for every driver at once.
  const tonight = await prisma.order.groupBy({
    by: ['driverId', 'status'],
    where: { shiftDate: dbDate(night), driverId: { in: ids } },
    _count: { _all: true },
  })
  const ratings = await prisma.orderRating.findMany({ where: { driverId: { in: ids }, createdAt: { gte: since } }, select: { driverId: true, stars: true, createdAt: true } })
  const misses = await prisma.driverMiss.groupBy({ by: ['driverId'], where: { driverId: { in: ids }, createdAt: { gte: since30 } }, _count: { _all: true } })
  const trend = weeklyAverages(ratings, now)
  const DONE = ['PICKED_UP', 'DISPOSAL_PENDING', 'DISPOSAL_VERIFIED', 'COMPLETED']

  const rows = drivers
    .filter((d) => d.driverProfile)
    .map((d) => {
      const p = d.driverProfile!
      const available = isDriverAvailable(p, now, settings)
      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        active: p.isActive,
        online: available,
        onlineSince: available && p.wentOnlineAt ? p.wentOnlineAt.toISOString() : null,
        overrideUntil: hasActiveOverride(p, now) ? p.onlineOverrideUntil!.toISOString() : null,
        vehicle: p.vehicleTypeRef?.name ?? null,
        capacityLitres: p.vehicleTypeRef?.capacityLitres ?? null,
        radiusKm: p.radiusKm,
        zone: p.zone?.name ?? null,
        hasHomeBase: p.homeLat != null,
        lastLocationAt: available && p.lastLocationAt ? p.lastLocationAt.toISOString() : null,
        ghanaCard: canEditId ? maskGhanaCard(p.ghanaCardNumber) : null,
        cardPhotoUrl: cardPhotos.get(d.id) ?? null,
        missingCard: canEditId && !p.ghanaCardNumber,
        stopsTonight: tonight.filter((t) => t.driverId === d.id && t.status !== 'CANCELLED').reduce((n, t) => n + t._count._all, 0),
        doneTonight: tonight.filter((t) => t.driverId === d.id && DONE.includes(t.status)).reduce((n, t) => n + t._count._all, 0),
        rating: (() => {
          const mine = ratings.filter((r) => r.driverId === d.id && r.createdAt >= since30)
          return mine.length ? Math.round((mine.reduce((n, r) => n + r.stars, 0) / mine.length) * 10) / 10 : null
        })(),
        trend: trend.get(d.id) ?? [],
        missed: misses.find((m) => m.driverId === d.id)?._count._all ?? 0,
      }
    })
    .sort((a, b) => Number(b.online) - Number(a.online))

  const shiftRunning = isWithinShift(now, settings)
  const onlineCount = rows.filter((r) => r.online).length
  const recent = ratings.filter((r) => r.createdAt >= since30)
  const avg = recent.length ? (recent.reduce((n, r) => n + r.stars, 0) / recent.length).toFixed(1) : null
  const stops = rows.reduce((n, r) => n + r.stopsTonight, 0)
  const done = rows.reduce((n, r) => n + r.doneTonight, 0)
  const missed = rows.reduce((n, r) => n + r.missed, 0)
  const worst = [...rows].sort((a, b) => b.missed - a.missed)[0]

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        title="Drivers"
        lead={`Shift hours ${windowLabel(settings)}; the shift is ${shiftRunning ? 'running now' : 'not running'}. ${onlineCount} of ${rows.length} ${
          rows.length === 1 ? 'driver' : 'drivers'
        } online. Drivers can only go online during shift hours; "Allow extra hours" lets one driver work outside them, for example to clear a backlog.`}
      />
      <div className="anim-stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi hero label="Online now" value={onlineCount} unit={`of ${rows.filter((r) => r.active).length}`} note={shiftRunning ? 'Shift running' : 'Shift not running'} />
        <Kpi label="Stops tonight" value={stops} note={`${done} collected`} />
        <Kpi label="Average rating, 30 days" value={avg ?? '—'} unit={avg ? '★' : undefined} note={`${recent.length} ${recent.length === 1 ? 'rating' : 'ratings'}`} />
        <Kpi label="Missed stops, 30 days" value={missed} note={missed && worst ? `Most: ${worst.name} (${worst.missed})` : 'None'} tone={missed ? 'bad' : 'good'} />
      </div>
      <DriversClient drivers={rows} canEditId={canEditId} />
    </div>
  )
}
