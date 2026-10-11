import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CalendarPlus, Clock, MapPin, Moon, Recycle, Truck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking, describeCollection, type ShiftSettings } from '@/lib/shift'
import { binsText, customerStatus, ghs, type OrderSnapshot } from '@/lib/order-status'
import { dateLabel, greeting } from '@/lib/format'
import { BUTTON_PRIMARY, Card, CardTitle, StageTrack, StatusPill, TextLink } from '@/components/ui'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'

export const dynamic = 'force-dynamic'

const ACTIVE = ['PENDING_PAYMENT', 'PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING'] as const
const DONE = ['DISPOSAL_VERIFIED', 'COMPLETED'] as const

// When a booking made right now would be collected (read outside the component: it uses the clock).
function bookingWindow(s: ShiftSettings): string {
  const b = classifyBooking(new Date(), s)
  return describeCollection(b.shiftDate, b.localDate, s)
}

function collectionFor(shiftDate: Date | null, s: ShiftSettings): string | null {
  if (!shiftDate) return null
  return describeCollection(shiftDate.toISOString().slice(0, 10), classifyBooking(new Date(), s).localDate, s)
}

export default async function CustomerHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile, active, recent, completed, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { address: true, homeLat: true, homePinConfirmedAt: true, zone: { select: { name: true } } },
    }),
    prisma.order.findFirst({
      where: { customerId: user.id, status: { in: [...ACTIVE] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        shiftDate: true,
        quoteSnapshot: true,
        driver: { select: { name: true, driverProfile: { select: { vehicleType: true } } } },
      },
    }),
    prisma.order.findMany({
      where: { customerId: user.id, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, createdAt: true, quoteSnapshot: true },
    }),
    prisma.order.findMany({ where: { customerId: user.id, status: { in: [...DONE] } }, select: { quoteSnapshot: true } }),
    getShiftSettings(),
  ])

  const firstName = me?.name.split(/\s+/)[0] ?? ''
  const hasHome = profile?.homeLat != null && !!profile.homePinConfirmedAt
  const binsCollected = completed.reduce(
    (n, o) => n + ((o.quoteSnapshot as OrderSnapshot | null)?.lines ?? []).reduce((s, l) => s + l.count, 0),
    0
  )
  const nextWindow = bookingWindow(settings)

  const activeStatus = active ? customerStatus(active.status) : null
  const activeQuote = active?.quoteSnapshot as OrderSnapshot | null
  const activeWhen = active ? collectionFor(active.shiftDate, settings) : null

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-bold leading-tight tracking-[-0.025em]">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-2">Your pickups, payments and home pin in one place.</p>
        </div>
        {active && (
          <Link href="/dashboard/customer/book" className={BUTTON_PRIMARY}>
            <CalendarPlus aria-hidden className="size-4" /> Book another pickup
          </Link>
        )}
      </div>

      {!hasHome && (
        <div className="flex flex-wrap items-center gap-4 rounded-card bg-customer-wash p-5 ring-1 ring-customer/20">
          <MapPin aria-hidden className="size-6 shrink-0 text-customer-deep" />
          <div className="min-w-[14rem] flex-1">
            <p className="font-semibold text-customer-deep">Pin your gate once</p>
            <p className="text-sm text-ink-2">Every booking will use it, and your driver goes straight to it at night.</p>
          </div>
          <Link href="/dashboard/customer/home-location" className={BUTTON_PRIMARY}>
            Set my home pin
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* The pickup on its way, or the next booking window */}
        {active && activeStatus ? (
          <Card>
            <CardTitle action={<StatusPill status={activeStatus} />}>Your pickup</CardTitle>
            <p className="text-xl font-bold tracking-tight">{activeStatus.message}</p>
            <p className="mt-1.5 text-sm text-ink-2">
              {[activeWhen, binsText(activeQuote), activeQuote?.address].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-6">
              <StageTrack stage={activeStatus.stage} />
            </div>
            {active.driver && (
              <p className="mt-6 flex items-center gap-3 rounded-control bg-canvas p-3 text-sm">
                <span className="grid size-9 place-items-center rounded-full bg-driver text-night">
                  <Truck aria-hidden className="size-4" />
                </span>
                <span>
                  <span className="block font-semibold">{active.driver.name.split(/\s+/)[0]} is your driver</span>
                  {active.driver.driverProfile?.vehicleType && (
                    <span className="block text-ink-3">{active.driver.driverProfile.vehicleType}</span>
                  )}
                </span>
              </p>
            )}
            <div className="mt-5">
              <TextLink href={`/dashboard/customer/orders/${active.id}`}>See pickup details →</TextLink>
            </div>
          </Card>
        ) : (
          <Card>
            <CardTitle>If you book now</CardTitle>
            <p className="flex items-start gap-3 text-xl font-bold tracking-tight">
              <Moon aria-hidden className="mt-1 size-5 shrink-0 text-ops" />
              {nextWindow}
            </p>
            <p className="mt-2 text-sm text-ink-2">Book by 6pm to join tonight&apos;s planned route. Late bookings are taken until midnight.</p>
            <Link href="/dashboard/customer/book" className={`mt-6 ${BUTTON_PRIMARY}`}>
              Book a pickup <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-card bg-surface p-5 ring-1 ring-line">
            <p className="text-sm text-ink-3">Pickups completed</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{completed.length}</p>
          </div>
          <div className="rounded-card bg-surface p-5 ring-1 ring-line">
            <p className="flex items-center gap-1.5 text-sm text-ink-3">
              <Recycle aria-hidden className="size-4 text-customer" /> Bins collected
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{binsCollected}</p>
          </div>
          <div className="col-span-2 rounded-card bg-surface p-5 ring-1 ring-line sm:col-span-1">
            <p className="flex items-center gap-1.5 text-sm text-ink-3">
              <MapPin aria-hidden className="size-4 text-customer" /> Your area
            </p>
            <p className="mt-1 truncate text-lg font-semibold">{profile?.zone?.name ?? (hasHome ? 'Outside our zones' : 'No home pin yet')}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardTitle action={<TextLink href="/dashboard/customer/orders">All orders →</TextLink>}>Recent orders</CardTitle>
        {recent.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-ink-2">
            <Clock aria-hidden className="size-4" /> No pickups yet. Your first booking will show here.
          </p>
        ) : (
          <ul className="-mx-2 divide-y divide-line">
            {recent.map((o) => {
              const s = customerStatus(o.status)
              const q = o.quoteSnapshot as OrderSnapshot | null
              return (
                <li key={o.id}>
                  <Link href={`/dashboard/customer/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control px-2 py-3.5 hover:bg-canvas">
                    <span className="w-28 shrink-0 text-sm text-ink-2">{dateLabel(o.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{binsText(q) || q?.address}</span>
                    <span className="text-sm font-semibold tabular-nums">{ghs(q?.price)}</span>
                    <StatusPill status={s} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Asked only once there's a paid pickup on the way: then an alert is worth having. */}
      {active && active.status !== 'PENDING_PAYMENT' && (
        <div className="grid gap-4 empty:hidden">
          <EnableAlerts compact message="Want a message when a driver is assigned to this pickup and when your bins are collected?" />
          <InstallPrompt />
        </div>
      )}
    </div>
  )
}
