import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DriverProfileSetupForm from '@/components/DriverProfileSetupForm'
import { Card, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function DriverProfileSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || dbUser.role !== 'DRIVER') redirect('/dashboard')

  const [zones, vehicleTypes, profile] = await Promise.all([
    prisma.zone.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.vehicleType.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, capacityLitres: true, defaultRadiusKm: true, maxRadiusKm: true, imagePath: true },
    }),
    prisma.driverProfile.findUnique({
      where: { userId: user.id },
      select: {
        vehicleTypeId: true,
        vehiclePlate: true,
        radiusKm: true,
        zoneId: true,
        homeAddress: true,
        homeLat: true,
        homeLng: true,
      },
    }),
  ])

  // First visit = setting up; later visits = editing.
  const isSetUp = !!profile?.vehicleTypeId && profile.homeLat != null

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isSetUp ? 'Vehicle & area' : `Welcome to Trashit, ${dbUser.name.split(/\s+/)[0]}`}
        lead={
          isSetUp
            ? 'Your vehicle, where you start each night, and how far you travel for pickups.'
            : "Let's finish setting up your driver profile before you start receiving stops."
        }
      />
      <Card>
        <DriverProfileSetupForm zones={zones} vehicleTypes={vehicleTypes} initial={profile} />
      </Card>
    </div>
  )
}
