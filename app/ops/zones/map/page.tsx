import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ZoneMap from '@/components/ZoneMap'

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
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Zone Map</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>
        Shaded circles show each zone's approximate coverage area. Click a marker for details.
      </p>

      {zonesWithCoords.length === 0 ? (
        <div className="panel"><p>No zones with coordinates yet. Add center latitude/longitude to a zone to see it here.</p></div>
      ) : (
        <ZoneMap zones={zonesWithCoords} />
      )}
    </div>
  )
}