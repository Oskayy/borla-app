import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, Flag, Phone } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { pickupLocationSource } from '@/lib/navigation'
import { storedSplit } from '@/lib/money-split'
import { getAcceptMinutes, getShiftSettings } from '@/lib/settings'
import { offerDeadline } from '@/lib/offers'
import Chip from '@/components/kit/Chip'
import ZoneMapCard from '@/components/driver/ZoneMapCard'
import NavigateButtons from '@/components/NavigateButtons'
import StopResponse from '@/components/StopResponse'
import StopPickupSheet from '@/components/driver/StopPickupSheet'
import FlashHost from '@/components/driver/Flash'
import type { MapMarker } from '@/components/kit/Map3D'

export const dynamic = 'force-dynamic'

// One stop, full screen: where it is on the map, navigate and call, then the photo panel to confirm the pickup.
// Only the driver the stop is assigned to can open it.
export default async function StopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
      status: true,
      latitude: true,
      longitude: true,
      quoteSnapshot: true,
      driverAcceptedAt: true,
      offeredAt: true,
      shiftDate: true,
      pricePesewas: true,
      platformFeePesewas: true,
      pickupSharePesewas: true,
      unloadSharePesewas: true,
      feeBps: true,
      pickupBps: true,
      distanceBonusPesewas: true,
      distanceBonusDriverId: true,
      customer: { select: { phone: true } },
      routeStop: { select: { tripNumber: true, route: { select: { trips: { select: { tripNumber: true, facility: { select: { name: true, lat: true, lng: true } } } } } } } },
    },
  })
  // Someone else's stop, or one that has moved on: it isn't this driver's to open.
  if (!order || order.driverId !== user.id) notFound()
  if (!['ASSIGNED', 'PICKED_UP', 'DISPOSAL_PENDING'].includes(order.status)) redirect('/dashboard/driver')

  const [settings, acceptMinutes] = await Promise.all([getShiftSettings(), getAcceptMinutes()])
  const quote = order.quoteSnapshot as { address?: string; lines?: { count: number; label: string }[] } | null
  const address = quote?.address ?? 'Address not available'
  const bins = quote?.lines?.map((l) => `${l.count} × ${l.label}`).join(', ') ?? null
  const split = storedSplit(order)
  const bonus = order.distanceBonusDriverId === user.id ? order.distanceBonusPesewas ?? 0 : 0
  const pay = split ? { total: (split.pool + bonus) / 100, pickup: split.pickup / 100, unload: (split.unload + bonus) / 100 } : null
  const approximate = pickupLocationSource(order.quoteSnapshot) === 'approximate'
  const accepted = order.driverAcceptedAt != null
  const deadline =
    order.status === 'ASSIGNED' && !accepted && order.offeredAt
      ? offerDeadline(order.offeredAt, order.shiftDate, settings.shiftStartMinutes, settings.timezone, acceptMinutes).toISOString()
      : null
  const site = order.routeStop?.route.trips.find((t) => t.tripNumber === order.routeStop?.tripNumber)?.facility ?? null
  const phone = order.customer?.phone ?? null
  const hasSpot = order.latitude != null && order.longitude != null
  const markers: MapMarker[] = hasSpot ? [{ lat: order.latitude!, lng: order.longitude!, kind: 'pin' }] : []

  return (
    <div className="grid max-w-4xl gap-5">
      <Link href="/dashboard/driver" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Tonight
      </Link>
      <FlashHost />

      {hasSpot ? (
        <ZoneMapCard markers={markers} title="Pickup spot" radius={approximate ? 'Approximate' : 'Exact pin'} stops={1} legend={false} />
      ) : (
        <p className="rounded-card bg-danger-wash p-4 text-sm font-medium text-danger">No map position for this stop. Call the customer or ops.</p>
      )}

      <section aria-labelledby="stop-title" className="anim-rise grid gap-4 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 id="stop-title" className="text-2xl font-bold leading-tight tracking-tight">
            {address}
          </h1>
          {order.status === 'PICKED_UP' ? (
            <Chip tone="progress">On board</Chip>
          ) : order.status === 'DISPOSAL_PENDING' ? (
            <Chip tone="waiting">Unload being checked</Chip>
          ) : !accepted ? (
            <Chip tone="progress">New</Chip>
          ) : (
            <Chip>To collect</Chip>
          )}
        </div>
        {bins && <p className="-mt-2 text-[15px] text-ink-2">{bins}</p>}
        {pay && (
          <p className="rounded-[16px] bg-canvas px-4 py-3 text-sm tabular-nums">
            <span className="font-semibold">Your pay GHS {pay.total.toFixed(2)}</span>
            <span className="text-ink-3">
              {' '}
              · {pay.pickup.toFixed(2)} at pickup, {pay.unload.toFixed(2)} after unload
            </span>
          </p>
        )}

        {order.status === 'ASSIGNED' && approximate && (
          <p className="flex items-start gap-2.5 rounded-[16px] bg-warn-wash p-3.5 text-[15px]">
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warn-deep" />
            This customer didn&apos;t pin their gate, so the spot is only approximate. Call them when you get close.
          </p>
        )}

        {order.status === 'ASSIGNED' && (
          <div className="grid gap-2.5">
            {hasSpot && <NavigateButtons lat={order.latitude!} lng={order.longitude!} quiet={accepted} big />}
            {phone && (
              <a href={`tel:${phone}`} className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold text-ink ring-1 ring-line-strong hover:bg-canvas">
                <Phone aria-hidden className="size-4" /> Call the customer
              </a>
            )}
          </div>
        )}

        {order.status === 'ASSIGNED' && !accepted && <StopResponse orderId={order.id} deadline={deadline} />}
        {order.status === 'ASSIGNED' && accepted && <StopPickupSheet orderId={order.id} address={address} />}

        {order.status !== 'ASSIGNED' && (
          <div className="anim-note flex items-start gap-3 rounded-[16px] bg-ok-wash p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ok-strong text-white">
              <Check aria-hidden className="size-5" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Collected</p>
              <p className="text-sm text-ink-2">
                {site ? (
                  <>
                    <Flag aria-hidden className="mr-1 inline size-3.5" />
                    Unload at {site.name} when this trip&apos;s stops are done.
                  </>
                ) : (
                  'Call ops for where to unload.'
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      <Link href="/dashboard/driver" className="press inline-flex min-h-12 items-center justify-center rounded-full px-5 font-semibold text-ink-2 ring-1 ring-line-strong hover:bg-surface">
        Back to tonight&apos;s list
      </Link>
    </div>
  )
}
