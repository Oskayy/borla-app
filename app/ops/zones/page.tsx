import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ZonesClient from '@/components/ZonesClient'
import { Map as MapIcon } from 'lucide-react'
import { BUTTON_QUIET, PageHeader } from '@/components/ui'
import { ZONE_EDIT_ROLES } from '@/lib/zones'
import { areaKm2, storedBoundary } from '@/lib/zone-shape'

// Dispatchers and Finance can look; only Ops Managers and Super Admins change outlines (lib/zones.ts).
const PRICE_EDIT_ROLES = ['SUPER_ADMIN', 'FINANCE']
const ALLOWED_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE']

export default async function ZonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) {
    redirect('/ops')
  }

  const zones = await prisma.zone.findMany({
    include: { _count: { select: { drivers: true, customers: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        title="Zones"
        lead="Where customers can book. Each zone is an outline on the map; a booking's pin must fall inside an active zone, and that zone's multiplier scales its price. Zones can't overlap, so every address has one price."
        action={
          <Link href="/ops/zones/map" className={BUTTON_QUIET}>
            <MapIcon aria-hidden className="size-4" /> See all on a map
          </Link>
        }
      />

      <ZonesClient
        zones={zones.map((z) => {
          const b = storedBoundary(z.boundary)
          return { ...z, boundary: b, areaKm2: b ? Math.round(areaKm2(b) * 10) / 10 : null, corners: b ? b.coordinates[0].length - 1 : 0 }
        })}
       canEditZones={ZONE_EDIT_ROLES.includes(dbUser.role)} canEditPrice={PRICE_EDIT_ROLES.includes(dbUser.role)} />
    </div>
  )
}
