import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DriverProfileSetupForm from '@/components/DriverProfileSetupForm'

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
    <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 20px' }}>
      <div className="panel">
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>{isSetUp ? 'My vehicle and area' : `Welcome to Trashit, ${dbUser.name}`}</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
          {isSetUp
            ? 'Update your vehicle, where you start each night, and how far you travel for pickups.'
            : "Let's finish setting up your driver profile before you start receiving jobs."}
        </p>
        <DriverProfileSetupForm zones={zones} vehicleTypes={vehicleTypes} initial={profile} />
      </div>
    </div>
  )
}
