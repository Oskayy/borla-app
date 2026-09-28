import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ZonesClient from '@/components/ZonesClient'

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
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26 }}>Zones</h1>
        <Link href="/ops/zones/map" className="btn-primary" style={{ textDecoration: 'none' }}>
          View on Map
        </Link>
      </div>

      <ZonesClient
        zones={zones}
        canEditZones={ZONE_EDIT_ROLES.includes(dbUser.role)}
        canEditPrice={PRICE_EDIT_ROLES.includes(dbUser.role)}
      />
    </div>
  )
}