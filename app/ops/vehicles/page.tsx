import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { VEHICLE_EDIT_ROLES } from '@/lib/vehicles'
import VehicleTypesClient from '@/components/VehicleTypesClient'
import { PageHeader } from '@/components/ui'

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
    <div>
      <PageHeader
        title="Vehicles"
        lead="Capacity decides how much fits on one trip before the driver unloads. The radius decides how far from a driver orders are offered; drivers choose their own, up to the maximum. Values are placeholders until real vehicles are measured."
      />
      <VehicleTypesClient vehicleTypes={vehicleTypes} largestBin={largestBin} canEdit={VEHICLE_EDIT_ROLES.includes(dbUser.role)} />
    </div>
  )
}
