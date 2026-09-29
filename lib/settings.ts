import { prisma } from '@/lib/prisma'
import { DEFAULT_SHIFT_SETTINGS, type ShiftSettings } from '@/lib/shift'

// The operating window lives in the database (one row, id = 1) so ops can change it
// without a code change. Falls back to the defaults if the row is missing.
export async function getShiftSettings(): Promise<ShiftSettings> {
  const row = await prisma.operatingSettings.findUnique({ where: { id: 1 } })
  if (!row) return DEFAULT_SHIFT_SETTINGS
  return {
    timezone: row.timezone,
    shiftStartMinutes: row.shiftStartMinutes,
    shiftEndMinutes: row.shiftEndMinutes,
    planningSnapshotMinutes: row.planningSnapshotMinutes,
    hardCutoffMinutes: row.hardCutoffMinutes,
  }
}

// How many round trips (collect, then unload at a disposal site) one driver can do in a shift.
export async function getMaxTripsPerNight(): Promise<number> {
  const row = await prisma.operatingSettings.findUnique({ where: { id: 1 }, select: { maxTripsPerNight: true } })
  return row?.maxTripsPerNight ?? 3
}
