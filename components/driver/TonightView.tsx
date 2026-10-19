import Link from 'next/link'
import { Check, ChevronRight, Flag, Moon } from 'lucide-react'
import ConfirmDisposalButton from '@/app/dashboard/driver/confirm-disposal-button'
import DriverOnlineToggle from '@/components/DriverOnlineToggle'
import Chip from '@/components/kit/Chip'
import NavigateButtons from '@/components/NavigateButtons'
import DriverRouteMap, { type RoutePoint } from '@/components/DriverRouteMap'
import ConfirmTripUnload from '@/components/ConfirmTripUnload'
import NextStopCard from '@/components/NextStopCard'
import DriverLiveUpdates from '@/components/DriverLiveUpdates'
import EnableAlerts from '@/components/EnableAlerts'
import type { NextPoint } from '@/lib/driver-next'
import FlashHost from '@/components/driver/Flash'
import { durationLabel } from '@/lib/trip-time'
import StepTrack from '@/components/kit/StepTrack'

// The driver's Tonight screen, as designed: the shift card (online switch), the next thing to do, then the night's
// trips (stops as rows that open the stop page, then where to unload) beside the map.
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

// A stop's state in a word, in the shared status colours (amber = on board or new, blue = with Trashit).
function stopState(o: Stop): { text: string; cls: string } {
  if (o.status === 'PICKED_UP') return { text: 'On board', cls: 'bg-warn-wash text-warn-deep' }
  if (o.status === 'DISPOSAL_PENDING') return { text: 'Unload being checked', cls: 'bg-info-wash text-info' }
  if (o.status === 'ASSIGNED' && !o.accepted) return { text: 'New', cls: 'bg-highlight text-on-highlight' }
  return { text: 'To collect', cls: 'bg-surface text-ink-2 ring-1 ring-line-strong' }
}

// A trip is done once nothing is left to collect or unload.
const tripDone = (g: TripGroup) => g.orders.every((o) => o.status === 'DISPOSAL_PENDING')

function TripCard({ g, firstStopNo, current }: { g: TripGroup; firstStopNo: number; current: boolean }) {
  const done = tripDone(g)
  const collected = g.orders.filter((o) => o.status === 'PICKED_UP')
  const toCollect = g.orders.filter((o) => o.status === 'ASSIGNED').length
  const chip = done ? { text: 'Done', tone: 'done' as const } : current ? { text: 'Now', tone: 'progress' as const } : { text: 'Next', tone: 'neutral' as const }
  const accepted = g.orders.filter((o) => o.status !== 'ASSIGNED' || o.accepted).length
  const picked = g.orders.filter((o) => o.status !== 'ASSIGNED').length
  const n = g.orders.length

  return (
    <section
      aria-labelledby={`trip-${g.key}`}
      className={`anim-rise grid gap-4 rounded-card bg-surface p-4 sm:p-5 ${current ? 'shadow-lift ring-2 ring-action-strong' : 'ring-1 ring-line'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`trip-${g.key}`} className="text-[19px] font-bold tracking-tight">
            Trip {g.tripNumber}
          </h3>
          <p className="truncate text-sm text-ink-3">
            {n} {n === 1 ? 'stop' : 'stops'}
            {!done && g.minutes != null && ` · ${durationLabel(g.minutes)}`} · unload at {g.site?.name ?? 'no site yet'}
          </p>
        </div>
        <Chip tone={chip.tone}>{chip.text}</Chip>
      </div>

      <StepTrack
        label={`Trip ${g.tripNumber} progress`}
        steps={[
          { label: 'Accepted', sub: `${accepted} of ${n}`, done: accepted === n },
          { label: 'Collected', sub: `${picked} of ${n}`, done: picked === n },
          { label: 'Unloaded', sub: g.site?.name ?? 'No site yet', done },
        ]}
      />

      {/* Each stop opens its own page: map, navigate, call, then the photo to confirm the pickup. */}
      <ol className="grid gap-2">
        {g.orders.map((order, i) => {
          const st = stopState(order)
          const finished = order.status !== 'ASSIGNED'
          return (
            <li key={order.id}>
              <Link
                href={`/dashboard/driver/stop/${order.id}`}
                className={`lift group flex items-center gap-3 rounded-[18px] bg-canvas p-3 ${order.status === 'DISPOSAL_PENDING' ? 'opacity-60' : ''}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${
                    finished ? 'bg-ok-wash text-ok-deep' : !order.accepted ? 'bg-highlight text-on-highlight' : 'bg-action text-on-action'
                  }`}
                >
                  {finished ? <Check aria-hidden className="size-4" strokeWidth={3} /> : firstStopNo + i}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{order.address}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {[order.bins, order.pay ? `your pay GHS ${order.pay.total.toFixed(2)}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.text}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />
              </Link>
              {order.status === 'PICKED_UP' && !g.routeId && (
                <div className="mt-2 pl-12">
                  <ConfirmDisposalButton orderId={order.id} />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* Then unload: the last step of the trip. */}
      <div className={`rounded-[18px] p-4 ${g.site ? 'bg-info-wash' : 'bg-danger-wash'}`}>
        {g.site ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info text-white">
                <Flag aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-info">Then unload at</p>
                <p className="font-semibold leading-snug">{g.site.name}</p>
                <p className="mt-0.5 text-sm text-ink-3">
                  {g.site.hours}
                  {g.site.status !== 'OPEN' && <span className="font-medium text-danger"> · {g.site.status.toLowerCase()} now: call ops</span>}
                </p>
              </div>
            </div>
            {!done && (
              <div className="mt-3 grid gap-2.5 sm:pl-12">
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
    </section>
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
      : `${orderCount} ${orderCount === 1 ? 'stop' : 'stops'} in ${groups.length} ${groups.length === 1 ? 'trip' : 'trips'}${minutesLeft > 0 ? ` · ${durationLabel(minutesLeft)}` : ''}`
  const firstStop: number[] = []
  groups.reduce((n, g) => (firstStop.push(n), n + g.orders.length), 1)

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em]">Tonight</h1>
        <DriverLiveUpdates initialVersion={routeVersion} />
      </div>

      {/* The online switch and the night in numbers; money lives on the Earnings tab. */}
      <DriverOnlineToggle initialOnline={online} canGoOnline={canGoOnline} shiftLabel={shiftLabel} overrideUntil={overrideUntil} summary={summary} />

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
        <section aria-labelledby="h-trips" className="grid gap-3">
          {/* The heading sits above both columns, so the first trip card and the map start level. */}
          <h2 id="h-trips" className="text-[17px] font-semibold tracking-tight">Your trips</h2>
          <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            {groups.map((g, i) => (
              <TripCard key={g.key} g={g} firstStopNo={firstStop[i]} current={g.key === currentKey} />
            ))}
          </div>

          {mapPoints.length > 0 && (
            <figure className="overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/70 md:sticky md:top-28">
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
        </section>
      )}
    </div>
  )
}
