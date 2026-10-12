import type { Prisma } from '@prisma/client'
import { distanceInMeters } from '@/lib/geo'
import { distanceBonus } from '@/lib/money-split'
import { ensureSplit } from '@/lib/order-split-server'

type Tx = Prisma.TransactionClient

// Fixes the distance bonus for the driver an order has just been given to (step 7): from the driver's home base to
// the customer's pin, under the active payout rule, never more than Trashit's platform fee on the order. Paid with
// the unload share. Reassigning the order fixes it again for the new driver. Never stops an assignment: if it can't
// be worked out (no pin, no home base, no rule), the bonus is 0.
export async function fixDistanceBonus(tx: Tx, orderIds: string[], driverId: string): Promise<void> {
  const [driver, rule] = await Promise.all([
    tx.driverProfile.findUnique({ where: { userId: driverId }, select: { homeLat: true, homeLng: true } }),
    tx.payoutRule.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      select: { distanceFreeKm: true, distanceBonusPerKm: true, distanceBonusCap: true },
    }),
  ])
  for (const id of orderIds) {
    let bonus = 0
    try {
      const o = await tx.order.findUnique({ where: { id }, select: { latitude: true, longitude: true } })
      if (rule && driver?.homeLat != null && driver.homeLng != null && o?.latitude != null && o.longitude != null) {
        const km = distanceInMeters(driver.homeLat, driver.homeLng, o.latitude, o.longitude) / 1000
        const split = await ensureSplit(tx, id)
        bonus = distanceBonus(
          km,
          { freeKm: rule.distanceFreeKm, perKmPesewas: Math.round(rule.distanceBonusPerKm * 100), capPesewas: Math.round(rule.distanceBonusCap * 100) },
          split.platformFee
        )
      }
    } catch {
      bonus = 0
    }
    await tx.order.update({ where: { id }, data: { distanceBonusPesewas: bonus, distanceBonusDriverId: driverId } })
  }
}
