import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import HomeLocationForm from '@/components/HomeLocationForm'
import { Card, PageHeader } from '@/components/customer/ui'

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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Home pin"
        lead="Set this once and every pickup uses it. You can still choose a different place for a single order. The shaded circles show where we collect."
      />
      <Card>
        <HomeLocationForm zones={zones} initial={initial} />
      </Card>
    </div>
  )
}
