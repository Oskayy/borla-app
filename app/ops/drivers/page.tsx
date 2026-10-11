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
      }
    })
    .sort((a, b) => Number(b.online) - Number(a.online))

  const shiftRunning = isWithinShift(now, settings)
  const onlineCount = rows.filter((r) => r.online).length

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Drivers"
        lead={`Shift hours ${windowLabel(settings)}; the shift is ${shiftRunning ? 'running now' : 'not running'}. ${onlineCount} of ${rows.length} ${
          rows.length === 1 ? 'driver' : 'drivers'
        } online. Drivers can only go online during shift hours; "Allow extra hours" lets one driver work outside them, for example to clear a backlog.`}
      />
      <DriversClient drivers={rows} canEditId={canEditId} />
    </div>
  )
}
