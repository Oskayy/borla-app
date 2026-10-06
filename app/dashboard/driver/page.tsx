import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import type { RoutePoint } from '@/components/DriverRouteMap'
import { nextPoint } from '@/lib/driver-next'
import { pickupLocationSource } from '@/lib/navigation'
import { sweepExpiredOffers } from '@/lib/offers-server'
import { offerDeadline } from '@/lib/offers'
import { driverRouteVersion } from '@/lib/driver-updates'
import { getAcceptMinutes } from '@/lib/settings'
import { getWalletSummary } from '@/lib/wallet-server'
import { getShiftSettings } from '@/lib/settings'
import { hasActiveOverride, isDriverAvailable, isWithinShift, windowLabel } from '@/lib/shift'
import { describeHours } from '@/lib/disposal-sites'
import { driverPoolFromSnapshot } from '@/lib/pricing-core'
import { planningShiftDate } from '@/lib/schedule'
import { worksNight } from '@/lib/availability'

export const dynamic = 'force-dynamic'

import TonightView, { type TripGroup } from '@/components/driver/TonightView'

export default async function DriverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: user.id } })

  // Drivers need a vehicle and a home base before they can be planned into routes.
  if (!driverProfile || !driverProfile.vehicleTypeId || driverProfile.homeLat == null) {
    redirect('/dashboard/driver/profile-setup')
  }
  // New drivers are checked before their first pickup.
  if (driverProfile.approvalStatus !== 'APPROVED') {
    redirect('/dashboard/driver/verification')
  }

  // Online only counts during the shift (or with an ops override), so drivers drop offline when the shift ends.
  const settings = await getShiftSettings()
  const now = new Date()
  const online = isDriverAvailable(driverProfile, now, settings)
  const override = hasActiveOverride(driverProfile, now)
  const canGoOnline = isWithinShift(now, settings) || override

  // Move on any stops (anyone's) that weren't accepted in time, so this page shows the current picture.
  await sweepExpiredOffers().catch((e) => console.error('[driver] sweep failed', e))
  const [acceptMinutes, routeVersion] = await Promise.all([getAcceptMinutes(), driverRouteVersion(user.id)])

  const orders = await prisma.order.findMany({
    where: {
      driverId: user.id,
      status: { in: ['ASSIGNED', 'PICKED_UP', 'DISPOSAL_PENDING'] },
    },
    include: {
      routeStop: {
        include: { route: { include: { trips: { include: { facility: true } } } } },
      },
      customer: { select: { phone: true } },
    },
    orderBy: [{ routeStop: { route: { createdAt: 'asc' } } }, { routeStop: { sequence: 'asc' } }],
  })

  const [wallet, payoutRule] = await Promise.all([
    getWalletSummary(user.id),
    prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { pickupPercent: true, disposalPercent: true } }),
  ])
  // The driver's pay for a stop: the same sums the pickup and unload payouts use (driver pool x the active rule).
  const payFor = (snapshot: unknown) => {
    const pool = driverPoolFromSnapshot(snapshot)
    if (pool === null || !payoutRule) return null
    const pickup = Math.round(pool * payoutRule.pickupPercent) / 100
    const unload = Math.round(pool * payoutRule.disposalPercent) / 100
    return { total: Math.round((pickup + unload) * 100) / 100, pickup, unload }
  }

  // Group the night's orders into trips: the stops, then where to unload.
  const groups: TripGroup[] = []
  for (const order of orders) {
    const stop = order.routeStop
    const tripNumber = stop?.tripNumber ?? 1
    const key = stop ? `${stop.routeId}-${tripNumber}` : 'unrouted'
    let group = groups.find((g) => g.key === key)
    if (!group) {
      const trip = stop?.route.trips.find((t) => t.tripNumber === tripNumber)
      const f = trip?.facility
      group = {
        key,
        routeId: stop?.routeId ?? null,
        routeTripNumber: tripNumber,
        tripNumber,
        orders: [],
        site: f
          ? { name: f.name, lat: f.lat, lng: f.lng, hours: describeHours(f), notes: f.notes, status: f.status }
          : null,
      }
      groups.push(group)
    }
    const quote = order.quoteSnapshot as { address?: string; price?: number; lines?: { count: number; label: string }[] } | null
    group.orders.push({
      id: order.id,
      status: order.status,
      sequence: stop?.sequence ?? null,
      address: quote?.address ?? 'Address not available',
      pay: payFor(order.quoteSnapshot),
      bins: quote?.lines?.map((l) => `${l.count} × ${l.label}`).join(', ') ?? null,
      lat: order.latitude,
      lng: order.longitude,
      accepted: order.driverAcceptedAt != null,
      deadline:
        order.status === 'ASSIGNED' && !order.driverAcceptedAt && order.offeredAt
          ? offerDeadline(order.offeredAt, order.shiftDate, settings.shiftStartMinutes, settings.timezone, acceptMinutes).toISOString()
          : null,
      approximate: pickupLocationSource(order.quoteSnapshot) === 'approximate',
      customerPhone: order.customer?.phone ?? null,
    })
  }
  // Number trips 1, 2, 3... across the whole night, even if they came from separate approvals.
  groups.forEach((g, i) => (g.tripNumber = i + 1))

  const mapPoints: RoutePoint[] = []
  let stopNo = 0
  for (const g of groups) {
    for (const o of g.orders) {
      stopNo++
      if (o.lat != null && o.lng != null) {
        mapPoints.push({ kind: 'stop', lat: o.lat, lng: o.lng, label: String(stopNo), done: o.status !== 'ASSIGNED' })
      }
    }
    if (g.site?.lat != null && g.site?.lng != null) {
      const tripDone = !g.orders.some((o) => o.status === 'ASSIGNED' || o.status === 'PICKED_UP')
      mapPoints.push({ kind: 'site', lat: g.site.lat, lng: g.site.lng, label: g.site.name, done: tripDone })
    }
  }
  const start = { lat: driverProfile.homeLat!, lng: driverProfile.homeLng! }

  // What to do next: accept new stops, then collect in order, then unload at the trip's site.
  const next = nextPoint(groups)
  const waiting = groups.flatMap((g) => g.orders).filter((o) => o.status === 'ASSIGNED' && !o.accepted)
  const waitingIds = waiting.map((o) => o.id)
  const firstDeadline = waiting.map((o) => o.deadline).filter((d): d is string => !!d).sort()[0] ?? null
  const nextPhone =
    next?.kind === 'stop' ? groups.flatMap((g) => g.orders).find((o) => o.id === next.orderId)?.customerPhone ?? null : null

  return (
    <TonightView
      orderCount={orders.length}
      groups={groups}
      online={online}
      canGoOnline={canGoOnline}
      shiftLabel={windowLabel(settings)}
      overrideUntil={override ? driverProfile.onlineOverrideUntil!.toISOString() : null}
      routeVersion={routeVersion}
      next={next}
      waitingIds={waitingIds}
      firstDeadline={firstDeadline}
      nextPhone={nextPhone}
      wallet={{ available: wallet.available, earned: wallet.earned }}
      mapPoints={mapPoints}
      offTonight={!worksNight(driverProfile, planningShiftDate(now, settings))}
      start={start}
    />
  )
}
