'use client'

import Link from 'next/link'
import { AlertTriangle, ChevronRight, Flag, MapPin, Phone } from 'lucide-react'
import NavigateButtons from '@/components/NavigateButtons'
import { AcceptAllButton, AcceptCountdown } from '@/components/StopResponse'
import { useLivePosition } from '@/lib/use-live-position'
import type { NextPoint } from '@/lib/driver-next'

// The one thing the driver should do next, at the top of the screen, with a single Navigate button.
export default function NextStopCard({
  next,
  online,
  waitingIds,
  firstDeadline,
  customerPhone,
}: {
  next: NextPoint
  online: boolean
  waitingIds: string[] // stops not accepted yet
  firstDeadline: string | null // the soonest accept deadline among them
  customerPhone: string | null // for the next stop, when its location is only approximate
}) {
  const { position, denied } = useLivePosition(online && !!next && (next.kind === 'stop' || next.kind === 'site'))

  if (!next) return null

  const card = 'rounded-card p-5 sm:p-6'
  const kicker = 'flex items-center gap-2 text-sm font-semibold'

  if (next.kind === 'accept') {
    return (
      <section className={`${card} anim-rise bg-surface ring-2 ring-action-strong`}>
        <p className={`${kicker} text-ink-2`}>New stops for you</p>
        <p className="mt-1 text-xl font-bold tracking-tight">
          {next.count === 1 ? 'You have 1 new stop.' : `You have ${next.count} new stops.`}
        </p>
        <p className="mt-1 text-[15px] text-ink-2">Accept to start, or decline any you can&apos;t do. A declined stop goes to another driver straight away.</p>
        {firstDeadline && <AcceptCountdown deadline={firstDeadline} big />}
        <AcceptAllButton orderIds={waitingIds} />
      </section>
    )
  }

  // Offline: the online switch already says what to do, so nothing more here.
  if (!online) return null

  const startNote = position
    ? `Directions start from where you are now (GPS within ${Math.round(position.accuracyM)} m).`
    : denied
      ? 'Location is blocked, so Google Maps will guess where you are. Turn location on for Trashit.'
      : 'Getting your GPS position…'

  if (next.kind === 'no-site') {
    return (
      <section className={`${card} bg-danger-wash`}>
        <p className={`${kicker} text-danger`}>Trip {next.tripNumber}: unload</p>
        <p className="mt-1 text-lg font-semibold">No disposal site is set for this trip. Please call ops before unloading.</p>
      </section>
    )
  }

  if (next.kind === 'site') {
    return (
      <section className={`${card} anim-rise bg-info-wash`}>
        <p className={`${kicker} text-info`}>
          <Flag aria-hidden className="size-4" /> Next: unload (trip {next.tripNumber})
        </p>
        <p className="mb-4 mt-1 text-2xl font-bold tracking-tight">{next.name}</p>
        {next.lat != null && next.lng != null ? (
          <NavigateButtons lat={next.lat} lng={next.lng} big />
        ) : (
          <p className="text-danger">No map position for this site. Call ops.</p>
        )}
        <p className="mt-3 text-xs text-ink-3">{startNote}</p>
      </section>
    )
  }

  return (
    <section className={`${card} anim-rise bg-surface ring-1 ring-line`}>
      <p className={`${kicker} text-ink-2`}>
        <MapPin aria-hidden className="size-4" /> Next: stop {next.stopNumber} (trip {next.tripNumber})
      </p>
      <p className="mb-4 mt-1 text-2xl font-bold leading-tight tracking-tight">{next.address}</p>
      {next.approximate && (
        <p className="mb-4 flex items-start gap-2.5 rounded-control bg-warn-wash p-3.5 text-[15px] text-ink">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warn-deep" />
          <span>
            This customer didn&apos;t pin their gate, so the location is only approximate.
            {customerPhone && (
              <>
                {' '}
                <a href={`tel:${customerPhone}`} className="inline-flex items-center gap-1 font-semibold text-action-deep underline underline-offset-2">
                  <Phone aria-hidden className="size-3.5" /> Call the customer
                </a>{' '}
                when you get close.
              </>
            )}
          </span>
        </p>
      )}
      {next.lat != null && next.lng != null ? (
        <NavigateButtons lat={next.lat} lng={next.lng} big />
      ) : (
        <p className="text-danger">No map position for this stop. Call the customer or ops.</p>
      )}
      <Link
        href={`/dashboard/driver/stop/${next.orderId}`}
        className="press mt-2.5 flex min-h-12 items-center justify-center gap-1.5 rounded-full font-semibold text-ink ring-1 ring-line-strong hover:bg-canvas"
      >
        Open stop to confirm pickup <ChevronRight aria-hidden className="size-4" />
      </Link>
      <p className="mt-3 text-xs text-ink-3">{startNote}</p>
    </section>
  )
}
