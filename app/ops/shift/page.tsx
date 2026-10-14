import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getMaxTripsPerNight, getShiftSettings, getAcceptMinutes, getAutoDispatch, getAcceptHazardous } from '@/lib/settings'
import { formatClock, toClock } from '@/lib/shift'
import ShiftSettingsForm from '@/components/ShiftSettingsForm'
import { PageHeader } from '@/components/ui'

const VIEW_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE']
const EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER']

export default async function ShiftSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !VIEW_ROLES.includes(dbUser.role)) redirect('/ops')

  const [s, trips, acceptMinutes, autoDispatch, acceptHazardous, hazardSites] = await Promise.all([
    getShiftSettings(),
    getMaxTripsPerNight(),
    getAcceptMinutes(),
    getAutoDispatch(),
    getAcceptHazardous(),
    prisma.facility.count({ where: { active: true, acceptedWaste: { has: 'hazardous' } } }),
  ])

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Shift hours"
        lead={`Collections run from ${formatClock(s.shiftStartMinutes)} to ${formatClock(s.shiftEndMinutes)} (${s.timezone} time). Orders paid before ${formatClock(
          s.planningSnapshotMinutes
        )} join tonight's planned batch; after that, until ${formatClock(s.hardCutoffMinutes)}, they join tonight as late orders. Anything later goes to the next night.`}
      />

      {EDIT_ROLES.includes(dbUser.role) ? (
        <ShiftSettingsForm
          initial={{
            shiftStart: toClock(s.shiftStartMinutes),
            shiftEnd: toClock(s.shiftEndMinutes),
            planningSnapshot: toClock(s.planningSnapshotMinutes),
            hardCutoff: toClock(s.hardCutoffMinutes),
            maxTripsPerNight: String(trips),
            acceptMinutes: String(acceptMinutes),
            autoDispatch,
            acceptHazardous,
          }}
          hazardSites={hazardSites}
        />
      ) : (
        <p className="rounded-card bg-surface p-5 text-[15px] text-ink-2 shadow-card ring-1 ring-line/70">
          Trips per night: {trips} · minutes to accept: {acceptMinutes} · automatic assignment {autoDispatch ? 'on' : 'off'} · hazardous
          waste {acceptHazardous ? 'accepted' : 'not accepted'}. Only a Super Admin or Ops
          Manager can change these.
        </p>
      )}
    </div>
  )
}
