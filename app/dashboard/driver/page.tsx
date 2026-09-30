import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ConfirmPickupButton from './confirm-pickup-button'
import ConfirmDisposalButton from './confirm-disposal-button'
import DriverOnlineToggle from '@/components/DriverOnlineToggle'
import NavigateButtons from '@/components/NavigateButtons'
import DriverRouteMap, { type RoutePoint } from '@/components/DriverRouteMap'
import ConfirmTripUnload from '@/components/ConfirmTripUnload'
import NextStopCard from '@/components/NextStopCard'
import StopResponse from '@/components/StopResponse'
import { nextPoint } from '@/lib/driver-next'
import { pickupLocationSource } from '@/lib/navigation'
import DriverLiveUpdates from '@/components/DriverLiveUpdates'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'
import { sweepExpiredOffers } from '@/lib/offers-server'
import { offerDeadline } from '@/lib/offers'
import { driverRouteVersion } from '@/lib/driver-updates'
import { getAcceptMinutes } from '@/lib/settings'
import { getShiftSettings } from '@/lib/settings'
import { hasActiveOverride, isDriverAvailable, isWithinShift, windowLabel } from '@/lib/shift'
import { describeHours } from '@/lib/disposal-sites'

export const dynamic = 'force-dynamic'

interface TripGroup {
  key: string
  routeId: string | null
  routeTripNumber: number // the trip number stored on the route (used when confirming)
  tripNumber: number // shown to the driver, counted across the whole night
  orders: {
    id: string
    status: string
    sequence: number | null
    address: string
    price: number | null
    bins: string | null
    lat: number | null
    lng: number | null
    accepted: boolean
    deadline: string | null // when an unaccepted stop goes to another driver
    approximate: boolean // the customer didn't pin this spot; the position was looked up from text
    customerPhone: string | null
  }[]
  site: { name: string; lat: number | null; lng: number | null; hours: string; notes: string | null; status: string } | null
}

export default async function DriverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: user.id } })

  // Drivers need a vehicle and a home base before they can be planned into routes.
  if (!driverProfile || !driverProfile.vehicleTypeId || driverProfile.homeLat == null) {
    redirect('/dashboard/driver/profile-setup')
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

  const earningsEntries = await prisma.ledgerEntry.findMany({
    where: {
      type: { in: ['driver_payout_pickup', 'driver_payout_disposal'] },
      order: { driverId: user.id },
    },
  })

  const totalEarnings = earningsEntries.reduce((sum, entry) => sum + entry.amount, 0)

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
      price: quote?.price ?? null,
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

  stopNo = 0
  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Driver Dashboard</h1>
      <DriverOnlineToggle
        initialOnline={online}
        canGoOnline={canGoOnline}
        shiftLabel={windowLabel(settings)}
        overrideUntil={override ? driverProfile.onlineOverrideUntil!.toISOString() : null}
      />

      <DriverLiveUpdates initialVersion={routeVersion} />
      <InstallPrompt />
      <EnableAlerts />
      <NextStopCard next={next} online={online} waitingIds={waitingIds} firstDeadline={firstDeadline} customerPhone={nextPhone} />

      <div className="panel" style={{ marginBottom: 24, background: 'var(--color-primary)', border: 'none', color: 'white' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Total earnings</p>
        <p style={{ margin: 0, fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
          GHS {totalEarnings.toFixed(2)}
        </p>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12, color: '#666' }}>
        Tonight&apos;s route{orders.length > 0 && ` · ${orders.length} stop(s) · ${groups.length} trip(s)`}
      </h2>

      {orders.length === 0 && (
        <div className="panel">
          <p>No active orders right now.</p>
        </div>
      )}

      {mapPoints.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <DriverRouteMap start={start} points={mapPoints} live={online} />
          <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            🔵 = you · numbers are stops in order · 🏁 = where to unload · faded = already collected
          </p>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>TRIP {g.tripNumber}</p>

          {g.orders.map((order) => {
            stopNo++
            return (
              <div key={order.id} className="panel" style={{ marginBottom: 10, opacity: order.status === 'PICKED_UP' ? 0.75 : 1 }}>
                <p style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 600, marginBottom: 2 }}>STOP {stopNo}</p>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>{order.address}</p>
                {order.bins && <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{order.bins}</p>}
                <p style={{ fontSize: 13, marginBottom: 10 }}>
                  <span className="status-dot" style={{ background: 'var(--color-accent)' }} />
                  {order.status === 'PICKED_UP'
                    ? 'Collected, on board'
                    : order.status === 'DISPOSAL_PENDING'
                    ? 'Unloaded, waiting for ops to check the photo'
                    : order.accepted
                    ? 'To collect'
                    : 'New: accept or decline'}
                  {order.price != null && <span style={{ color: '#999' }}> · GHS {order.price}</span>}
                </p>
                {order.status === 'ASSIGNED' && order.approximate && (
                  <p style={{ fontSize: 12, color: '#9A6415', marginBottom: 8 }}>
                    ⚠ Approximate location (no pin).{' '}
                    {order.customerPhone && <a href={`tel:${order.customerPhone}`}>Call the customer</a>}
                  </p>
                )}
                {order.status === 'ASSIGNED' && !order.accepted && <StopResponse orderId={order.id} deadline={order.deadline} />}
                {order.status === 'ASSIGNED' && order.accepted && order.lat != null && order.lng != null && (
                  <NavigateButtons lat={order.lat} lng={order.lng} />
                )}
                {order.status === 'ASSIGNED' && order.accepted && <ConfirmPickupButton orderId={order.id} />}
                {order.status === 'PICKED_UP' && !g.routeId && <ConfirmDisposalButton orderId={order.id} />}
              </div>
            )
          })}

          <div className="panel" style={{ borderLeft: '4px solid var(--color-primary)', background: '#F2F7F4' }}>
            {g.site ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 2 }}>🏁 THEN UNLOAD AT</p>
                <p style={{ fontWeight: 600 }}>{g.site.name}</p>
                <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  {g.site.hours}
                  {g.site.status !== 'OPEN' && <span style={{ color: '#B3261E' }}> · currently {g.site.status.toLowerCase()}: call ops</span>}
                  {g.site.notes && ` · ${g.site.notes}`}
                </p>
                {g.site.lat != null && g.site.lng != null && <NavigateButtons lat={g.site.lat} lng={g.site.lng} />}
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#B3261E' }}>🏁 No disposal site set for this trip. Please call ops before unloading.</p>
            )}
            {(() => {
              const collected = g.orders.filter((o) => o.status === 'PICKED_UP')
              if (!g.routeId || collected.length === 0) return null
              return (
                <ConfirmTripUnload
                  routeId={g.routeId}
                  tripNumber={g.routeTripNumber}
                  photoOrderId={collected[0].id}
                  collectedCount={collected.length}
                  waitingCount={g.orders.filter((o) => o.status === 'ASSIGNED').length}
                />
              )
            })()}
          </div>
        </div>
      ))}
    </div>
  )
}
