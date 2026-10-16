import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import HomeLocationForm from '@/components/HomeLocationForm'
import { Card, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function HomeLocationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, zones] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { userId: user.id } }),
    prisma.zone.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  const initial = profile ? { address: profile.address, landmark: profile.homeLandmark ?? '', lat: profile.homeLat, lng: profile.homeLng } : null
  // A new customer lands here first (components/customer/RequireHomePin.tsx) and goes home once it is saved.
  const setup = !profile || profile.homeLat == null || !profile.homePinConfirmedAt

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={setup ? 'First, pin your home' : 'Home pin'}
        lead={
          setup
            ? 'Welcome to Trashit. Before your first booking, show us where to collect: your area, a landmark drivers can see at night, and a pin on your gate. It takes a minute, and every pickup uses it.'
            : 'Set this once and every pickup uses it. You can still choose a different place for a single order.'
        }
      />
      <Card>
        <HomeLocationForm zones={zones} initial={initial} setup={setup} />
      </Card>
    </div>
  )
}
