import Link from 'next/link'
import { AlertTriangle, CalendarDays, ChevronRight, Flag, Moon } from 'lucide-react'
import ConfirmPickupButton from '@/app/dashboard/driver/confirm-pickup-button'
import ConfirmDisposalButton from '@/app/dashboard/driver/confirm-disposal-button'
import DriverOnlineToggle from '@/components/DriverOnlineToggle'
import NavigateButtons from '@/components/NavigateButtons'
import DriverRouteMap, { type RoutePoint } from '@/components/DriverRouteMap'
import ConfirmTripUnload from '@/components/ConfirmTripUnload'
import NextStopCard from '@/components/NextStopCard'
import StopResponse from '@/components/StopResponse'
import DriverLiveUpdates from '@/components/DriverLiveUpdates'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'
import type { NextPoint } from '@/lib/driver-next'

// The driver's Tonight screen: online switch, the next thing to do, balance, map, and the night's trips.
// Data comes from app/dashboard/driver/page.tsx (or sample data in the dev-only preview).

export interface TripGroup {
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

export interface TonightProps {
  orderCount: number
  groups: TripGroup[]
  online: boolean
  canGoOnline: boolean
  shiftLabel: string
  overrideUntil: string | null
  routeVersion: string
  next: NextPoint
  waitingIds: string[]
  firstDeadline: string | null
  nextPhone: string | null
  wallet: { available: number; earned: number }
  mapPoints: RoutePoint[]
  start: { lat: number; lng: number }
  offTonight?: boolean // the driver marked tonight off (Availability)
}

export default function TonightView({
  orderCount,
  groups,
  online,
  canGoOnline,
  shiftLabel,
  overrideUntil,
  routeVersion,
  next,
  waitingIds,
  firstDeadline,
  nextPhone,
  wallet,
  mapPoints,
  start,
  offTonight = false,
}: TonightProps) {
  let stopNo = 0
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-bold leading-tight tracking-[-0.025em]">Tonight</h1>
          <p className="mt-1 text-[15px] text-ink-3">
            {orderCount === 0
              ? 'No stops on your list yet.'
              : `${orderCount} ${orderCount === 1 ? 'stop' : 'stops'} in ${groups.length} ${groups.length === 1 ? 'trip' : 'trips'}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/driver/availability" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-action-deep hover:underline">
            <CalendarDays aria-hidden className="size-4" /> My nights
          </Link>
          <DriverLiveUpdates initialVersion={routeVersion} />
        </div>
      </div>

      {offTonight && (
        <p className="flex items-start gap-2.5 rounded-card bg-surface p-4 text-[15px] ring-1 ring-line">
          <Moon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <span>
            You&apos;re off tonight, so dispatch won&apos;t send you new stops.{' '}
            <Link href="/dashboard/driver/availability" className="font-semibold text-action-deep hover:underline">
              Change
            </Link>
          </span>
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="grid gap-4">
          <DriverOnlineToggle initialOnline={online} canGoOnline={canGoOnline} shiftLabel={shiftLabel} overrideUntil={overrideUntil} />
          <NextStopCard next={next} online={online} waitingIds={waitingIds} firstDeadline={firstDeadline} customerPhone={nextPhone} />
          <div className="grid gap-3 empty:hidden">
            <EnableAlerts message="Turn on alerts so your phone rings when stops are added to your route, even when Trashit is closed." />
            <InstallPrompt />
          </div>
        </div>

        <div className="grid gap-4">
          <Link
            href="/dashboard/driver/earnings"
            className="flex items-center justify-between gap-4 rounded-card bg-surface p-5 ring-1 ring-line transition hover:ring-action/50"
          >
            <span>
              <span className="block text-sm text-ink-3">Balance to withdraw</span>
              <span className="mt-0.5 block text-3xl font-bold tabular-nums tracking-tight">GHS {wallet.available.toFixed(2)}</span>
              <span className="mt-0.5 block text-sm text-ink-3">Earned GHS {wallet.earned.toFixed(2)} in total</span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-action-deep">
              Withdraw <ChevronRight aria-hidden className="size-4" />
            </span>
          </Link>

          {mapPoints.length > 0 && (
            <figure className="overflow-hidden rounded-card ring-1 ring-line">
              <DriverRouteMap start={start} points={mapPoints} live={online} />
              <figcaption className="flex flex-wrap gap-x-4 gap-y-1 bg-surface px-4 py-2.5 text-xs text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-[#3b82f6]" /> You
                </span>
                <span>Numbers: stops in order</span>
                <span className="inline-flex items-center gap-1.5">
                  <Flag aria-hidden className="size-3.5" /> Where to unload
                </span>
                <span>Faded: already collected</span>
              </figcaption>
            </figure>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <section aria-label="Tonight's trips" className="grid gap-8">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="mb-3 text-sm font-semibold text-ink-3">Trip {g.tripNumber}</h2>
              <ol className="grid gap-3">
                {g.orders.map((order) => {
                  stopNo++
                  const state =
                    order.status === 'PICKED_UP'
                      ? { text: 'Collected, on board', cls: 'text-customer-deep' }
                      : order.status === 'DISPOSAL_PENDING'
                        ? { text: 'Unloaded, waiting for ops to check the photo', cls: 'text-ops-deep' }
                        : order.accepted
                          ? { text: 'To collect', cls: 'text-action-deep' }
                          : { text: 'New: accept or decline', cls: 'text-action-deep' }
                  return (
                    <li key={order.id} className={`rounded-card bg-surface p-4 ring-1 ring-line sm:p-5 ${order.status === 'PICKED_UP' ? 'opacity-80' : ''}`}>
                      <div className="flex items-start gap-3.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-sm font-bold tabular-nums ring-1 ring-line">{stopNo}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold leading-snug">{order.address}</p>
                          <p className="mt-0.5 text-sm text-ink-3">
                            {[order.bins, order.price != null ? `GHS ${order.price.toFixed(2)}` : null].filter(Boolean).join(' · ')}
                          </p>
                          <p className={`mt-1 text-sm font-semibold ${state.cls}`}>{state.text}</p>
                        </div>
                      </div>
                      {order.status === 'ASSIGNED' && order.approximate && (
                        <p className="mt-3 flex items-start gap-2 rounded-control bg-driver-wash p-3 text-sm text-ink">
                          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-driver-deep" />
                          <span>
                            Approximate location (no pin).{' '}
                            {order.customerPhone && (
                              <a href={`tel:${order.customerPhone}`} className="font-semibold text-action-deep underline underline-offset-2">
                                Call the customer
                              </a>
                            )}
                          </span>
                        </p>
                      )}
                      <div className="mt-4 grid gap-3 empty:hidden">
                        {order.status === 'ASSIGNED' && !order.accepted && <StopResponse orderId={order.id} deadline={order.deadline} />}
                        {order.status === 'ASSIGNED' && order.accepted && order.lat != null && order.lng != null && (
                          <NavigateButtons lat={order.lat} lng={order.lng} quiet />
                        )}
                        {order.status === 'ASSIGNED' && order.accepted && <ConfirmPickupButton orderId={order.id} />}
                        {order.status === 'PICKED_UP' && !g.routeId && <ConfirmDisposalButton orderId={order.id} />}
                      </div>
                    </li>
                  )
                })}
              </ol>

              <div className={`mt-3 rounded-card p-4 ring-1 sm:p-5 ${g.site ? 'bg-ops-wash ring-ops/30' : 'bg-danger-wash ring-danger/30'}`}>
                {g.site ? (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ops-deep">
                      <Flag aria-hidden className="size-4" /> Then unload at
                    </p>
                    <p className="mt-1 text-lg font-semibold">{g.site.name}</p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {g.site.hours}
                      {g.site.status !== 'OPEN' && <span className="text-danger"> · currently {g.site.status.toLowerCase()}: call ops</span>}
                      {g.site.notes && ` · ${g.site.notes}`}
                    </p>
                    {g.site.lat != null && g.site.lng != null && (
                      <div className="mt-3">
                        <NavigateButtons lat={g.site.lat} lng={g.site.lng} quiet />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-danger">
                    <Flag aria-hidden className="size-4" /> No disposal site set for this trip. Please call ops before unloading.
                  </p>
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
        </section>
      )}
    </div>
  )
}
