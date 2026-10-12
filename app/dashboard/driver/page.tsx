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
import { getShiftSettings } from '@/lib/settings'
import { hasActiveOverride, isDriverAvailable, isWithinShift, windowLabel } from '@/lib/shift'
import { describeHours } from '@/lib/disposal-sites'
import { ghsToPesewas, pctToBps, splitOrder, storedSplit } from '@/lib/money-split'
import { planningShiftDate } from '@/lib/schedule'
import { worksNight } from '@/lib/availability'
import { LIVE_LOCATION_MAX_AGE_MINUTES } from '@/lib/dispatch'
import { tripMinutes, type Point } from '@/lib/trip-time'

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

  const payoutRule = await prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { pickupPercent: true } })
  // The driver's pay for a stop: the split frozen when the customer paid (lib/money-split.ts). Orders paid before
  // splits were stored show what they'll get at pickup: the same sums from their price and the active rule.
  const payFor = (
    order: Parameters<typeof storedSplit>[0] & { quoteSnapshot: unknown; distanceBonusPesewas: number | null; distanceBonusDriverId: string | null }
  ) => {
    let split = storedSplit(order)
    if (!split) {
      const s = order.quoteSnapshot as { price?: unknown; platformFeePercent?: unknown } | null
      if (typeof s?.price !== 'number' || s.price <= 0 || !payoutRule) return null
      const fee = typeof s.platformFeePercent === 'number' ? pctToBps(s.platformFeePercent) : 0
      split = splitOrder(ghsToPesewas(s.price), fee, pctToBps(payoutRule.pickupPercent))
    }
    // The distance bonus fixed for this driver comes with the unload share.
    const bonus = order.distanceBonusDriverId === user.id ? order.distanceBonusPesewas ?? 0 : 0
    return { total: (split.pool + bonus) / 100, pickup: split.pickup / 100, unload: (split.unload + bonus) / 100, bonus: bonus / 100 }
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
          ? { name: f.name, lat: f.lat, lng: f.lng, hours: describeHours(f), notes: f.notes, status: f.status, unloadMinutes: f.avgUnloadMinutes }
          : null,
        minutes: null,
      }
      groups.push(group)
    }
    const quote = order.quoteSnapshot as { address?: string; price?: number; lines?: { count: number; label: string }[] } | null
    group.orders.push({
      id: order.id,
      status: order.status,
      sequence: stop?.sequence ?? null,
      address: quote?.address ?? 'Address not available',
      pay: payFor(order),
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

  // About how long each unfinished trip takes: from where the driver is (live GPS if recent, else home),
  // through the stops still to collect, to the site and unloading. The next trip starts from that site.
  const liveFresh =
    driverProfile.currentLat != null &&
    driverProfile.currentLng != null &&
    driverProfile.lastLocationAt != null &&
    now.getTime() - driverProfile.lastLocationAt.getTime() <= LIVE_LOCATION_MAX_AGE_MINUTES * 60000
  let here: Point | null = liveFresh
    ? { lat: driverProfile.currentLat!, lng: driverProfile.currentLng! }
    : { lat: driverProfile.homeLat!, lng: driverProfile.homeLng! }
  for (const g of groups) {
    if (g.orders.every((o) => o.status === 'DISPOSAL_PENDING')) continue
    const collect = g.orders
      .filter((o) => o.status === 'ASSIGNED')
      .map((o) => (o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null))
    const site = g.site?.lat != null && g.site?.lng != null ? { lat: g.site.lat, lng: g.site.lng, unloadMinutes: g.site.unloadMinutes } : null
    g.minutes = Math.round(tripMinutes(here, collect, site))
    if (site) here = site
  }

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
      mapPoints={mapPoints}
      offTonight={!worksNight(driverProfile, planningShiftDate(now, settings))}
      start={start}
    />
  )
}
