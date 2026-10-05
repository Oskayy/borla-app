import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DriverProfileSetupForm from '@/components/DriverProfileSetupForm'
import { Card, PageHeader } from '@/components/ui'
import VehicleChangeCard from '@/components/driver/VehicleChangeCard'
import { VEHICLE_CHANGE_DOC, vehicleChangeStage } from '@/lib/vehicle-change'

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
        approvalStatus: true,
        pendingVehicleTypeId: true,
        pendingRadiusKm: true,
        pendingVehicleAt: true,
        vehicleChangeNote: true,
      },
    }),
  ])
  const changePhotos = profile?.pendingVehicleTypeId
    ? await prisma.driverDocument.count({ where: { driverId: user.id, type: VEHICLE_CHANGE_DOC } })
    : 0
  const stage = profile
    ? vehicleChangeStage({ ...profile, hasPhoto: changePhotos > 0 })
    : 'none'
  const nameOf = (id: string | null | undefined) => vehicleTypes.find((v) => v.id === id)?.name ?? null

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
      {stage !== 'none' && (
        <div className="mb-6">
          <VehicleChangeCard
            stage={stage}
            currentName={nameOf(profile?.vehicleTypeId) ?? 'current vehicle'}
            newName={nameOf(profile?.pendingVehicleTypeId)}
            note={profile?.vehicleChangeNote ?? null}
          />
        </div>
      )}
      <Card>
        <DriverProfileSetupForm
          zones={zones}
          vehicleTypes={vehicleTypes}
          initial={profile}
          approved={profile?.approvalStatus === 'APPROVED'}
        />
      </Card>
    </div>
  )
}
