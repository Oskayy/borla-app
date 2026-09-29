import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import HomeLocationForm from '@/components/HomeLocationForm'

export const dynamic = 'force-dynamic'

export default async function HomeLocationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, zones] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { userId: user.id } }),
    prisma.zone.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  const initial = profile ? { address: profile.address, lat: profile.homeLat, lng: profile.homeLng } : null

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>My Home Location</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Set this once and we&apos;ll use it for every pickup. You can still choose a different address for a single order.
        The shaded circles show the areas we collect from.
      </p>
      <div className="panel">
        <HomeLocationForm zones={zones} initial={initial} />
      </div>
    </div>
  )
}