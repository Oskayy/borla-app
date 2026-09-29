import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OPS_ROLES } from '@/lib/auth'
import { getShiftSettings } from '@/lib/settings'
import { hasActiveOverride, isDriverAvailable, isWithinShift, windowLabel } from '@/lib/shift'
import DriversClient from '@/components/DriversClient'

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
          },
        },
      },
    }),
    getShiftSettings(),
  ])

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
      }
    })
    .sort((a, b) => Number(b.online) - Number(a.online))

  const shiftRunning = isWithinShift(now, settings)
  const onlineCount = rows.filter((r) => r.online).length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Drivers</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Shift hours {windowLabel(settings)} · the shift is <strong>{shiftRunning ? 'running now' : 'not running'}</strong> ·{' '}
        <strong>{onlineCount}</strong> of {rows.length} driver(s) online. Drivers can only go online during shift hours.
        &quot;Allow extra hours&quot; lets one driver work outside them (for example to clear a backlog).
      </p>
      <DriversClient drivers={rows} />
    </div>
  )
}
