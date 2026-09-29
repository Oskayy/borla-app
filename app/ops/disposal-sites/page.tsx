import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { coversShift, describeHours, SITE_EDIT_ROLES, SITE_STATUS_ROLES } from '@/lib/disposal-sites'
import { formatClock } from '@/lib/shift'
import DisposalSitesClient from '@/components/DisposalSitesClient'

const VIEW_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE']

export const dynamic = 'force-dynamic'

export default async function DisposalSitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !VIEW_ROLES.includes(dbUser.role)) redirect('/ops')

  const [sites, zones, shift] = await Promise.all([
    prisma.facility.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    prisma.zone.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, centerLat: true, centerLng: true, radiusKm: true, active: true },
    }),
    getShiftSettings(),
  ])

  const rows = sites.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    geofenceRadiusM: s.geofenceRadiusM,
    open24Hours: s.open24Hours,
    opensAtMinutes: s.opensAtMinutes,
    closesAtMinutes: s.closesAtMinutes,
    acceptedWaste: s.acceptedWaste,
    status: s.status,
    avgUnloadMinutes: s.avgUnloadMinutes,
    notes: s.notes,
    zoneId: s.zoneId,
    active: s.active,
    hoursLabel: describeHours(s),
    coversShift: coversShift(s, shift.shiftStartMinutes, shift.shiftEndMinutes),
  }))

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Disposal Sites</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Where drivers unload. Each trip ends at the best open site that accepts its waste, and the disposal photo must be
        taken inside the site&apos;s geofence to release the driver&apos;s 60%. Shift hours are{' '}
        {formatClock(shift.shiftStartMinutes)} – {formatClock(shift.shiftEndMinutes)}, so sites need to be open at night.
        Pins marked &quot;Placeholder&quot; are rough positions: move them to the real sites.
      </p>
      <DisposalSitesClient
        sites={rows}
        zones={zones}
        canEdit={SITE_EDIT_ROLES.includes(dbUser.role)}
        canSetStatus={SITE_STATUS_ROLES.includes(dbUser.role)}
      />
    </div>
  )
}