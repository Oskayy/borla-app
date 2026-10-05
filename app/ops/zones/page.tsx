import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ZonesClient from '@/components/ZonesClient'
import { Map as MapIcon } from 'lucide-react'
import { BUTTON_QUIET, PageHeader } from '@/components/ui'

const ZONE_EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']
const PRICE_EDIT_ROLES = ['SUPER_ADMIN', 'FINANCE']
const ALLOWED_ROLES = [...ZONE_EDIT_ROLES, 'FINANCE']

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
    <div className="max-w-4xl">
      <PageHeader
        title="Zones"
        lead="Where customers can book. A booking's pin must fall inside an active zone, and each zone's multiplier scales its prices."
        action={
          <Link href="/ops/zones/map" className={BUTTON_QUIET}>
            <MapIcon aria-hidden className="size-4" /> See all on a map
          </Link>
        }
      />

      <ZonesClient zones={zones} canEditZones={ZONE_EDIT_ROLES.includes(dbUser.role)} canEditPrice={PRICE_EDIT_ROLES.includes(dbUser.role)} />
    </div>
  )
}
