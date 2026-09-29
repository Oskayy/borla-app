import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getMaxTripsPerNight, getShiftSettings, getAcceptMinutes, getAutoDispatch } from '@/lib/settings'
import { formatClock, toClock } from '@/lib/shift'
import ShiftSettingsForm from '@/components/ShiftSettingsForm'

const VIEW_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE']
const EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER']

export default async function ShiftSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !VIEW_ROLES.includes(dbUser.role)) redirect('/ops')

  const [s, trips, acceptMinutes, autoDispatch] = await Promise.all([
    getShiftSettings(),
    getMaxTripsPerNight(),
    getAcceptMinutes(),
    getAutoDispatch(),
  ])

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Shift Hours</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Collections run from {formatClock(s.shiftStartMinutes)} to {formatClock(s.shiftEndMinutes)} ({s.timezone} time).
        Orders paid before {formatClock(s.planningSnapshotMinutes)} join tonight&apos;s planned batch. Orders paid after
        that, until {formatClock(s.hardCutoffMinutes)}, join tonight as late orders. Anything later goes to the next night.
      </p>

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
          }}
        />
      ) : (
        <div className="panel">
          <p style={{ fontSize: 13 }}>Only a Super Admin or Ops Manager can change shift hours.</p>
        </div>
      )}
    </div>
  )
}
