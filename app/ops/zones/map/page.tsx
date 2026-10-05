import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ZoneMap from '@/components/ZoneMap'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BUTTON_QUIET, PageHeader } from '@/components/ui'
import { AllClear } from '@/components/ops/kit'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

export default async function ZoneMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) {
    redirect('/ops')
  }

  const zones = await prisma.zone.findMany({ orderBy: { createdAt: 'desc' } })

  const zonesWithCoords = zones.filter((z) => z.centerLat != null && z.centerLng != null)

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Zone map"
        lead="Shaded circles show each zone's approximate coverage. Click a marker for details."
        action={
          <Link href="/ops/zones" className={BUTTON_QUIET}>
            <ArrowLeft aria-hidden className="size-4" /> Zones
          </Link>
        }
      />

      {zonesWithCoords.length === 0 ? (
        <AllClear>No zones with a centre yet. Add a centre latitude and longitude to a zone to see it here.</AllClear>
      ) : (
        <div className="overflow-hidden rounded-card ring-1 ring-line">
          <ZoneMap zones={zonesWithCoords} />
        </div>
      )}
    </div>
  )
}
