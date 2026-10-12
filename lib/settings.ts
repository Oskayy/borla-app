import { prisma } from '@/lib/prisma'
import { DEFAULT_SHIFT_SETTINGS, type ShiftSettings } from '@/lib/shift'
import { NO_TAX, type TaxRates } from '@/lib/tax'

// The operating window lives in the database (one row, id = 1) so ops can change it
// without a code change. Falls back to the defaults if the row is missing.
export async function getShiftSettings(): Promise<ShiftSettings> {
  const row = await prisma.operatingSettings.findUnique({
    where: { id: 1 },
    select: { timezone: true, shiftStartMinutes: true, shiftEndMinutes: true, planningSnapshotMinutes: true, hardCutoffMinutes: true },
  })
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

// Whether customers can book hazardous waste. Off until a disposal site takes it; ops plan those orders by hand.
export async function getAcceptHazardous(): Promise<boolean> {
  try {
    const row = await prisma.operatingSettings.findUnique({ where: { id: 1 }, select: { acceptHazardous: true } })
    return row?.acceptHazardous ?? false
  } catch {
    return false // the column isn't there yet (migration not run): stay off
  }
}

// Whether the app may send driver payouts through Paystack (Finance page switch). Off: payouts wait for Finance
// to pay by hand. Also off if the setting can't be read (e.g. before its migration has run).
export async function getPaystackTransfers(): Promise<boolean> {
  try {
    const row = await prisma.operatingSettings.findUnique({ where: { id: 1 }, select: { paystackTransfers: true } })
    return row?.paystackTransfers ?? false
  } catch {
    return false
  }
}

// Tax rates (lib/tax.ts), in basis points. All 0 until the accountant confirms them (or if they can't be read).
export async function getTaxRates(): Promise<TaxRates & { withholdingBps: number }> {
  try {
    const row = await prisma.operatingSettings.findUnique({
      where: { id: 1 },
      select: { vatPercent: true, nhilPercent: true, getfundPercent: true, withholdingPercent: true },
    })
    const bps = (p: number | undefined) => Math.max(0, Math.min(10_000, Math.round((p ?? 0) * 100)))
    return { vatBps: bps(row?.vatPercent), nhilBps: bps(row?.nhilPercent), getfundBps: bps(row?.getfundPercent), withholdingBps: bps(row?.withholdingPercent) }
  } catch {
    return { ...NO_TAX, withholdingBps: 0 }
  }
}

// Whether waiting orders are assigned automatically from shift start (ops can still approve plans earlier).
export async function getAutoDispatch(): Promise<boolean> {
  const row = await prisma.operatingSettings.findUnique({ where: { id: 1 }, select: { autoDispatch: true } })
  return row?.autoDispatch ?? true
}
