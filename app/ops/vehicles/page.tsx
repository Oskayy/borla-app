import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { VEHICLE_EDIT_ROLES } from '@/lib/vehicles'
import VehicleTypesClient from '@/components/VehicleTypesClient'

const VIEW_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE']

export default async function VehiclesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !VIEW_ROLES.includes(dbUser.role)) redirect('/ops')

  const [vehicleTypes, largestBin] = await Promise.all([
    prisma.vehicleType.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { drivers: true } } },
    }),
    prisma.binSize.findFirst({ where: { active: true }, orderBy: { litres: 'desc' }, select: { label: true, litres: true } }),
  ])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Vehicles</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Capacity decides how many orders fit on one trip before the driver must go to a disposal site. The radius
        decides how far from a driver orders are offered. Drivers choose their own radius up to the maximum. All
        values here are placeholders until you measure real vehicles.
      </p>
      <VehicleTypesClient
        vehicleTypes={vehicleTypes}
        largestBin={largestBin}
        canEdit={VEHICLE_EDIT_ROLES.includes(dbUser.role)}
      />
    </div>
  )
}