import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { getMaxTripsPerNight, getShiftSettings } from '@/lib/settings'
import { inRange } from '@/lib/numbers'
import { parseClock, toClock, validateShiftSettings, type ShiftSettings } from '@/lib/shift'

// Changing the operating window affects every booking, so only senior ops can do it.
const SHIFT_EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER']

export async function GET() {
  const auth = await requireAuth([...OPS_ROLES, 'FINANCE'])
  if (!auth.ok) return auth.response
  return NextResponse.json({ settings: await getShiftSettings() })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(SHIFT_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'shift_change', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const start = parseClock(body?.shiftStart)
  const end = parseClock(body?.shiftEnd)
  const snapshot = parseClock(body?.planningSnapshot)
  const cutoff = parseClock(body?.hardCutoff)
  if (start === null || end === null || snapshot === null || cutoff === null) {
    return NextResponse.json({ error: 'Please enter every time as HH:MM (24-hour clock)' }, { status: 400 })
  }
  const trips = inRange(body?.maxTripsPerNight, 1, 8)
  if (trips === null || !Number.isInteger(trips)) {
    return NextResponse.json({ error: 'Trips per night must be a whole number from 1 to 8' }, { status: 400 })
  }

  const [current, currentTrips] = await Promise.all([getShiftSettings(), getMaxTripsPerNight()])
  const next: ShiftSettings = {
    timezone: current.timezone,
    shiftStartMinutes: start,
    shiftEndMinutes: end,
    planningSnapshotMinutes: snapshot,
    hardCutoffMinutes: cutoff,
  }
  const problem = validateShiftSettings(next)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  await prisma.operatingSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...next, maxTripsPerNight: trips },
    update: { ...next, maxTripsPerNight: trips },
  })

  const fmt = (s: ShiftSettings) =>
    `shift ${toClock(s.shiftStartMinutes)}-${toClock(s.shiftEndMinutes)}, snapshot ${toClock(s.planningSnapshotMinutes)}, cutoff ${toClock(s.hardCutoffMinutes)}`
  await logAdminAction(
    auth.user.id,
    'SHIFT_SETTINGS_CHANGED',
    null,
    `${fmt(current)}, ${currentTrips} trip(s) -> ${fmt(next)}, ${trips} trip(s)`
  )

  return NextResponse.json({ success: true, settings: next })
}
