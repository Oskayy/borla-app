import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { planningShiftDate } from '@/lib/schedule'
import { pruneNightsOff } from '@/lib/availability'
import { Card, PageHeader } from '@/components/ui'
import AvailabilityForm from '@/components/driver/AvailabilityForm'

export const dynamic = 'force-dynamic'

// The nights the driver works. Dispatch leaves them out on nights they are off.
export default async function DriverAvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, settings, stopsTonight] = await Promise.all([
    prisma.driverProfile.findUnique({ where: { userId: user.id }, select: { workNights: true, nightsOff: true } }),
    getShiftSettings(),
    prisma.order.count({ where: { driverId: user.id, status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'] } } }),
  ])
  if (!profile) redirect('/dashboard/driver/profile-setup')
  const tonight = planningShiftDate(new Date(), settings)

  return (
    <div className="max-w-4xl">
      <PageHeader title="Availability" lead="Choose the nights you work. On your nights off, you won't be planned or sent new stops." />
      <Card>
        <AvailabilityForm
          initial={{ workNights: profile.workNights, nightsOff: pruneNightsOff(profile.nightsOff, tonight) }}
          tonight={tonight}
          stopsTonight={stopsTonight}
        />
      </Card>
    </div>
  )
}
