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

// Minutes a driver has to accept a stop before it is given to another driver.
export async function getAcceptMinutes(): Promise<number> {
  const row = await prisma.operatingSettings.findUnique({ where: { id: 1 }, select: { acceptMinutes: true } })
  return row?.acceptMinutes ?? 15
}

// Whether waiting orders are assigned automatically from shift start (ops can still approve plans earlier).
export async function getAutoDispatch(): Promise<boolean> {
  const row = await prisma.operatingSettings.findUnique({ where: { id: 1 }, select: { autoDispatch: true } })
  return row?.autoDispatch ?? true
}
