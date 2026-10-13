import Link from 'next/link'
import { AlertTriangle, CalendarDays, Check, ChevronDown, Flag, Moon, Phone, Wallet } from 'lucide-react'
import ConfirmPickupButton from '@/app/dashboard/driver/confirm-pickup-button'
import ConfirmDisposalButton from '@/app/dashboard/driver/confirm-disposal-button'
import DriverOnlineToggle, { HeroLink } from '@/components/DriverOnlineToggle'
import NavigateButtons from '@/components/NavigateButtons'
import DriverRouteMap, { type RoutePoint } from '@/components/DriverRouteMap'
import ConfirmTripUnload from '@/components/ConfirmTripUnload'
import NextStopCard from '@/components/NextStopCard'
import StopResponse from '@/components/StopResponse'
import DriverLiveUpdates from '@/components/DriverLiveUpdates'
import EnableAlerts from '@/components/EnableAlerts'
import type { NextPoint } from '@/lib/driver-next'
import FlashHost from '@/components/driver/Flash'
import { durationLabel } from '@/lib/trip-time'
import StepTrack from '@/components/driver/StepTrack'

// The driver's Tonight screen: online switch and balance side by side, the next thing to do, then the night's
// trips (one card each: stops, then where to unload) beside the map.
// Data comes from app/dashboard/driver/page.tsx.

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
    pay: { total: number; pickup: number; unload: number; bonus?: number } | null // the driver's pay for the stop (not the customer's price)
    bins: string | null
    lat: number | null
    lng: number | null
    accepted: boolean
    deadline: string | null // when an unaccepted stop goes to another driver
    approximate: boolean // the customer didn't pin this spot; the position was looked up from text
    customerPhone: string | null
  }[]
  site: { name: string; lat: number | null; lng: number | null; hours: string; notes: string | null; status: string; unloadMinutes?: number } | null
  minutes: number | null // about how long what's left of this trip takes (null once it's done)
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
  mapPoints: RoutePoint[]
  start: { lat: number; lng: number }
  offTonight?: boolean // the driver marked tonight off (Availability)
}

type Stop = TripGroup['orders'][number]

// A stop's state in a word, with the role colour of whose hands it is in.
function stopState(o: Stop): { text: string; cls: string } {
  if (o.status === 'PICKED_UP') return { text: 'On board', cls: 'bg-driver-wash text-driver-deep' }
  if (o.status === 'DISPOSAL_PENDING') return { text: 'Unload being checked', cls: 'bg-ops-wash text-ops-deep' }
  if (o.status === 'ASSIGNED' && !o.accepted) return { text: 'New', cls: 'bg-action text-on-action' }
  return { text: 'To collect', cls: 'bg-surface text-ink-2 ring-1 ring-line-strong' }
}

// A trip is done once nothing is left to collect or unload.
const tripDone = (g: TripGroup) => g.orders.every((o) => o.status === 'DISPOSAL_PENDING')

function TripCard({ g, firstStopNo, current, currentStopId }: { g: TripGroup; firstStopNo: number; current: boolean; currentStopId: string | null }) {
  const done = tripDone(g)
  const collected = g.orders.filter((o) => o.status === 'PICKED_UP')
  const toCollect = g.orders.filter((o) => o.status === 'ASSIGNED').length
  const badge = done ? { text: 'Done', cls: 'bg-customer-wash text-customer-deep' } : current ? { text: 'Now', cls: 'bg-ops-wash text-ops-deep' } : { text: 'Next', cls: 'bg-canvas text-ink-2 ring-1 ring-line' }
  const accepted = g.orders.filter((o) => o.status !== 'ASSIGNED' || o.accepted).length
  const picked = g.orders.filter((o) => o.status !== 'ASSIGNED').length
  const n = g.orders.length

  return (
    <details open={!done} className={`group overflow-hidden rounded-card bg-surface ${current ? 'ring-2 ring-ink' : ''}`}>
      {/* Trip header: always visible; tap to fold a finished trip away. */}
      <summary className="flex cursor-pointer list-none items-center gap-3.5 px-4 pb-3 pt-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full text-lg font-bold tabular-nums ${
            done ? 'bg-customer-wash text-customer-deep' : current ? 'bg-action text-on-action' : 'bg-canvas text-ink'
          }`}
        >
          {done ? <Check aria-hidden className="size-5" strokeWidth={3} /> : g.tripNumber}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Trip {g.tripNumber}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>{badge.text}</span>
          </span>
          <span className="block truncate text-sm text-ink-3">
            {g.orders.length} {g.orders.length === 1 ? 'stop' : 'stops'}
            {!done && g.minutes != null && ` · ${durationLabel(g.minutes)}`} · unload at {g.site?.name ?? 'no site yet'}
          </span>
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-3 transition group-open:rotate-180" />
      </summary>

      <div className="px-4 pb-4 pt-1 sm:px-5">
        <StepTrack
          label={`Trip ${g.tripNumber} progress`}
          steps={[
            { label: 'Accepted', sub: `${accepted} of ${n}`, done: accepted === n },
            { label: 'Collected', sub: `${picked} of ${n}`, done: picked === n },
            { label: 'Unloaded', sub: g.site?.name ?? 'No site yet', done },
          ]}
        />
      </div>

      <ol className="mx-2.5 divide-y divide-line rounded-[18px] bg-canvas sm:mx-3">
        {g.orders.map((order, i) => {
          const st = stopState(order)
          const finished = order.status === 'DISPOSAL_PENDING'
          return (
            <li key={order.id} className={`px-4 py-4 sm:px-5 ${finished ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-action text-sm font-bold tabular-nums text-on-action">{firstStopNo + i}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-semibold leading-snug">{order.address}</p>
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.text}</span>
                  </div>
                  {order.bins && <p className="mt-0.5 text-sm text-ink-3">{order.bins}</p>}
                  {order.pay && (
                    <p className="mt-1 text-sm tabular-nums">
                      <span className="font-semibold text-ink">Your pay GHS {order.pay.total.toFixed(2)}</span>
                      <span className="text-ink-3">
                        {' '}
                        · {order.pay.pickup.toFixed(2)} at pickup, {order.pay.unload.toFixed(2)} after unload
                        {(order.pay.bonus ?? 0) > 0 && ` (incl. ${order.pay.bonus!.toFixed(2)} distance bonus)`}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {order.status === 'ASSIGNED' && order.approximate && (
                <p className="mt-3 flex items-start gap-2 rounded-control bg-driver-wash p-3 text-sm">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-driver-deep" />
                  <span>
                    No exact pin.{' '}
                    {order.customerPhone && (
                      <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 font-semibold text-action-deep underline underline-offset-2">
                        <Phone aria-hidden className="size-3.5" /> Call the customer
                      </a>
                    )}
                  </span>
                </p>
              )}

              <div className="mt-3 grid gap-2.5 pl-11 empty:hidden">
                {order.status === 'ASSIGNED' && !order.accepted && <StopResponse orderId={order.id} deadline={order.deadline} />}
                {order.status === 'ASSIGNED' && order.accepted && order.lat != null && order.lng != null && <NavigateButtons lat={order.lat} lng={order.lng} quiet />}
                {order.status === 'ASSIGNED' && order.accepted && (order.id === currentStopId || currentStopId === null ? (
                  <ConfirmPickupButton orderId={order.id} />
                ) : (
                  <details className="group/act">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                      <ChevronDown aria-hidden className="size-4 transition group-open/act:rotate-180" /> Pickup actions
                    </summary>
                    <div className="mt-2">
                      <ConfirmPickupButton orderId={order.id} />
                    </div>
                  </details>
                ))}
                {order.status === 'PICKED_UP' && !g.routeId && <ConfirmDisposalButton orderId={order.id} />}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Then unload: the last step of the trip, in the same card. */}
      <div className={`m-2.5 rounded-[18px] px-4 py-4 sm:m-3 sm:px-5 ${g.site ? 'bg-ops-wash' : 'bg-danger-wash'}`}>
        {g.site ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ops text-white">
                <Flag aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ops-deep">Then unload at</p>
                <p className="text-lg font-semibold leading-snug">{g.site.name}</p>
                <p className="mt-0.5 text-sm text-ink-3">
                  {g.site.hours}
                  {g.site.status !== 'OPEN' && <span className="font-medium text-danger"> · {g.site.status.toLowerCase()} now: call ops</span>}
                </p>
              </div>
            </div>
            {!done && (
              <div className="mt-3 grid gap-2.5 pl-11">
                {collected.length > 0 && g.site.lat != null && g.site.lng != null && <NavigateButtons lat={g.site.lat} lng={g.site.lng} quiet />}
                {g.routeId && collected.length > 0 && (
                  <ConfirmTripUnload
                    routeId={g.routeId}
                    tripNumber={g.routeTripNumber}
                    photoOrderId={collected[0].id}
                    collectedCount={collected.length}
                    waitingCount={toCollect}
                  />
                )}
                {collected.length === 0 && toCollect > 0 && <p className="text-sm text-ink-3">Collect the stops above first.</p>}
              </div>
            )}
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <Flag aria-hidden className="size-4" /> No disposal site for this trip yet. Call ops before unloading.
          </p>
        )}
      </div>
    </details>
  )
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
  mapPoints,
  start,
  offTonight = false,
}: TonightProps) {
  const currentKey = groups.find((g) => !tripDone(g))?.key ?? null
  const minutesLeft = groups.reduce((m, g) => m + (g.minutes ?? 0), 0)
  const summary =
    orderCount === 0
      ? 'No stops on your list yet'
      : `${orderCount} ${orderCount === 1 ? 'stop' : 'stops'} in ${groups.length} ${groups.length === 1 ? 'trip' : 'trips'}${minutesLeft > 0 ? ` · about ${durationLabel(minutesLeft)}` : ''}`
  const firstStop: number[] = []
  groups.reduce((n, g) => (firstStop.push(n), n + g.orders.length), 1)

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em]">Tonight</h1>
        <DriverLiveUpdates initialVersion={routeVersion} />
      </div>

      {/* The online switch and the night in numbers; money lives on the Earnings tab. */}
      <DriverOnlineToggle initialOnline={online} canGoOnline={canGoOnline} shiftLabel={shiftLabel} overrideUntil={overrideUntil} summary={summary}>
        <HeroLink href="/dashboard/driver/availability" icon={<CalendarDays aria-hidden className="size-[18px]" />}>
          My nights
        </HeroLink>
        <HeroLink href="/dashboard/driver/earnings" icon={<Wallet aria-hidden className="size-[18px]" />}>
          Earnings
        </HeroLink>
      </DriverOnlineToggle>

      {offTonight && (
        <p className="flex items-start gap-2.5 rounded-card bg-surface p-4 text-[15px]">
          <Moon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <span>
            You&apos;re off tonight, so dispatch won&apos;t send you new stops.{' '}
            <Link href="/dashboard/driver/availability" className="font-semibold text-action-deep hover:underline">
              Change
            </Link>
          </span>
        </p>
      )}

      <FlashHost />
      {next?.kind === 'accept' && (
        <NextStopCard next={next} online={online} waitingIds={waitingIds} firstDeadline={firstDeadline} customerPhone={nextPhone} />
      )}


      {next?.kind !== 'accept' && (
        <NextStopCard next={next} online={online} waitingIds={waitingIds} firstDeadline={firstDeadline} customerPhone={nextPhone} />
      )}
      {(online || orderCount > 0) && (
        <EnableAlerts compact message="Turn on alerts so your phone rings when stops are added, even with Trashit closed." />
      )}

      {groups.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="h-trips" className="grid gap-4">
            <h2 id="h-trips" className="text-[17px] font-semibold tracking-tight">Your trips</h2>
            {groups.map((g, i) => (
              <TripCard
                key={g.key}
                g={g}
                firstStopNo={firstStop[i]}
                current={g.key === currentKey}
                currentStopId={next?.kind === 'stop' ? next.orderId : null}
              />
            ))}
          </section>

          {mapPoints.length > 0 && (
            <figure className="overflow-hidden rounded-card bg-surface lg:sticky lg:top-36">
              <DriverRouteMap start={start} points={mapPoints} live={online} />
              <figcaption className="flex flex-wrap gap-x-4 gap-y-1 bg-surface px-4 py-2.5 text-xs text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-[#3b82f6]" /> You
                </span>
                <span>Numbers: stops in order</span>
                <span className="inline-flex items-center gap-1.5">
                  <Flag aria-hidden className="size-3.5" /> Where to unload
                </span>
              </figcaption>
            </figure>
          )}
        </div>
      )}
    </div>
  )
}
