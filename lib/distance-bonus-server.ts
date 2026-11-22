import type { Prisma } from '@prisma/client'
import { distanceInMeters } from '@/lib/geo'
import { distanceBonus } from '@/lib/money-split'
import { ensureSplit } from '@/lib/order-split-server'
import { estimatePaymentFee } from '@/lib/accounts'
import { LIVE_LOCATION_MAX_AGE_MINUTES } from '@/lib/dispatch'

type Tx = Prisma.TransactionClient
type Point = { lat: number; lng: number }

// Fixes the distance bonus for the driver orders have just been given to (step 7), under the active payout rule.
// Paid with the unload share. Reassigning an order fixes it again for the new driver. Never stops an assignment: if
// it can't be worked out (no pin, no rule), the bonus is 0.
//
// Measured from where the driver really comes from, not their home base (which they can set themselves):
//  - the first order: their live position if their phone sent one in the last 15 minutes, else the last stop on the
//    route they're already doing tonight, else their home base;
//  - each next order in orderIds (a planned route, in driving order): the order before it.
// Never more than what Trashit keeps on the order: its platform fee minus Paystack's fee on the payment.
export async function fixDistanceBonus(tx: Tx, orderIds: string[], driverId: string): Promise<void> {
  const [driver, rule] = await Promise.all([
    tx.driverProfile.findUnique({
      where: { userId: driverId },
      select: { homeLat: true, homeLng: true, currentLat: true, currentLng: true, lastLocationAt: true },
    }),
    tx.payoutRule.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      select: { distanceFreeKm: true, distanceBonusPerKm: true, distanceBonusCap: true },
    }),
  ])
  let from = await startPoint(tx, driver, driverId, orderIds)
  for (const id of orderIds) {
    let bonus = 0
    const o = await tx.order.findUnique({
      where: { id },
      select: { latitude: true, longitude: true, payments: { where: { status: { in: ['success', 'partially_refunded'] } }, select: { amount: true }, take: 1 } },
    })
    try {
      if (rule && from && o?.latitude != null && o.longitude != null) {
        const km = distanceInMeters(from.lat, from.lng, o.latitude, o.longitude) / 1000
        const split = await ensureSplit(tx, id)
        const paid = o.payments[0] ? Math.round(o.payments[0].amount * 100) : split.price
        bonus = distanceBonus(
          km,
          { freeKm: rule.distanceFreeKm, perKmPesewas: Math.round(rule.distanceBonusPerKm * 100), capPesewas: Math.round(rule.distanceBonusCap * 100) },
          Math.max(0, split.platformFee - estimatePaymentFee(paid))
        )
      }
    } catch {
      bonus = 0
    }
    await tx.order.update({ where: { id }, data: { distanceBonusPesewas: bonus, distanceBonusDriverId: driverId } })
    if (o?.latitude != null && o.longitude != null) from = { lat: o.latitude, lng: o.longitude }
  }
}

async function startPoint(
  tx: Tx,
  d: { homeLat: number | null; homeLng: number | null; currentLat: number | null; currentLng: number | null; lastLocationAt: Date | null } | null,
  driverId: string,
  orderIds: string[]
): Promise<Point | null> {
  if (!d) return null
  if (d.currentLat != null && d.currentLng != null && d.lastLocationAt && Date.now() - d.lastLocationAt.getTime() <= LIVE_LOCATION_MAX_AGE_MINUTES * 60_000) {
    return { lat: d.currentLat, lng: d.currentLng }
  }
  // The last stop of the route they're doing now (not these orders, which may already be on it).
  const last = await tx.routeStop.findFirst({
    where: {
      route: { driverId },
      orderId: { notIn: orderIds },
      order: { status: { in: ['ASSIGNED', 'PICKED_UP'] }, latitude: { not: null }, longitude: { not: null } },
    },
    orderBy: [{ route: { createdAt: 'desc' } }, { sequence: 'desc' }],
    select: { order: { select: { latitude: true, longitude: true } } },
  })
  if (last?.order.latitude != null && last.order.longitude != null) return { lat: last.order.latitude, lng: last.order.longitude }
  return d.homeLat != null && d.homeLng != null ? { lat: d.homeLat, lng: d.homeLng } : null
}
