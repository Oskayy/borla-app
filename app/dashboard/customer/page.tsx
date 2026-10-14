import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ChevronRight, Clock, MapPin, Plus, Recycle, Truck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { bookingHint, classifyBooking, describeCollection, type ShiftSettings } from '@/lib/shift'
import { binsText, CUSTOMER_STAGES, customerStatus, ghs, type OrderSnapshot } from '@/lib/order-status'
import { dateLabel, greeting } from '@/lib/format'
import Chip from '@/components/kit/Chip'
import HeroCard from '@/components/kit/HeroCard'
import StepTrack from '@/components/kit/StepTrack'
import PinMapCard from '@/components/customer/PinMapCard'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'

export const dynamic = 'force-dynamic'

const ACTIVE = ['PENDING_PAYMENT', 'PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING'] as const
const DONE = ['DISPOSAL_VERIFIED', 'COMPLETED'] as const

// Read outside the component: these use the clock.
function hintNow(s: ShiftSettings): string {
  return bookingHint(new Date(), s)
}
function collectionFor(shiftDate: Date | null, s: ShiftSettings): string | null {
  if (!shiftDate) return null
  return describeCollection(shiftDate.toISOString().slice(0, 10), classifyBooking(new Date(), s).localDate, s)
}

// The customer's home: one greeting, one main button (Book a pickup), the pickup on its way as the dark card,
// the saved pin on a 3D map, and earlier pickups.
export default async function CustomerHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile, active, recent, completed, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { address: true, homeLat: true, homeLng: true, homePinConfirmedAt: true, zone: { select: { name: true } } },
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
  const hasHome = profile?.homeLat != null && profile.homeLng != null && !!profile.homePinConfirmedAt
  const binsCollected = completed.reduce(
    (n, o) => n + ((o.quoteSnapshot as OrderSnapshot | null)?.lines ?? []).reduce((s, l) => s + l.count, 0),
    0
  )
  const hint = hintNow(settings)
  const place = profile?.address?.split(',')[0]?.trim() ?? ''

  const activeStatus = active ? customerStatus(active.status) : null
  const activeQuote = active?.quoteSnapshot as OrderSnapshot | null
  const activeWhen = active ? collectionFor(active.shiftDate, settings) : null
  const earlier = recent.filter((o) => o.id !== active?.id)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="anim-stagger grid gap-6">
        <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.03em]">
          {greeting()}, {firstName}
        </h1>

        <div className="grid gap-2.5">
          <Link
            href="/dashboard/customer/book"
            className="press flex min-h-16 items-center justify-center gap-2.5 rounded-full bg-action px-6 text-lg font-bold text-on-action shadow-lift transition hover:brightness-105"
          >
            <Plus aria-hidden className="size-6" strokeWidth={2.6} /> Book a pickup
          </Link>
          <p className="text-center text-sm text-ink-3">{hint}</p>
        </div>

        {active && activeStatus && (
          <HeroCard aria-labelledby="pickup-title" className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-on-hero-2">{activeWhen ?? 'Your pickup'}</p>
              <Chip tone={activeStatus.tone}>{activeStatus.label}</Chip>
            </div>
            <div>
              <h2 id="pickup-title" className="text-xl font-bold leading-snug tracking-tight">
                {activeStatus.message}
              </h2>
              <p className="mt-1.5 text-sm text-on-hero-2">
                {[binsText(activeQuote), activeQuote?.price != null ? ghs(activeQuote.price) : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            <StepTrack
              onHero
              label="Pickup progress"
              steps={CUSTOMER_STAGES.map((label, i) => ({ label: label === 'Driver assigned' ? 'Driver' : label, done: i <= activeStatus.stage }))}
            />
            {active.driver && (
              <p className="flex items-center gap-3 rounded-[18px] bg-white/8 p-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-highlight text-on-highlight">
                  <Truck aria-hidden className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{active.driver.name.split(/\s+/)[0]} is your driver</span>
                  {active.driver.driverProfile?.vehicleType && <span className="block truncate text-on-hero-2">{active.driver.driverProfile.vehicleType}</span>}
                </span>
              </p>
            )}
            <Link
              href={`/dashboard/customer/orders/${active.id}`}
              className="press inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-white/10 px-4 text-sm font-semibold text-on-hero hover:bg-white/15"
            >
              See pickup details <ArrowRight aria-hidden className="size-4" />
            </Link>
          </HeroCard>
        )}

        <section aria-labelledby="earlier-title" className="grid gap-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 id="earlier-title" className="text-sm font-semibold text-ink-3">
              {active ? 'Earlier' : 'Your pickups'}
            </h2>
            {earlier.length > 0 && (
              <Link href="/dashboard/customer/orders" className="min-h-9 content-center text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
                All orders
              </Link>
            )}
          </div>
          {earlier.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-card bg-surface p-4 text-sm text-ink-2 ring-1 ring-line">
              <Clock aria-hidden className="size-4 shrink-0" /> {active ? 'Your earlier pickups will show here.' : 'No pickups yet. Your first booking will show here.'}
            </p>
          ) : (
            <ul className="grid gap-2">
              {earlier.map((o) => {
                const q = o.quoteSnapshot as OrderSnapshot | null
                const s = customerStatus(o.status)
                return (
                  <li key={o.id}>
                    <Link
                      href={`/dashboard/customer/orders/${o.id}`}
                      className="lift flex items-center gap-3 rounded-[18px] bg-surface px-4 py-3.5 ring-1 ring-line"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{dateLabel(o.createdAt)}</span>
                        <span className="block truncate text-sm text-ink-3">{[binsText(q), q?.price != null ? ghs(q.price) : null].filter(Boolean).join(' · ')}</span>
                      </span>
                      <Chip tone={s.tone}>{s.label}</Chip>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="anim-stagger grid gap-6">
        {hasHome ? (
          <PinMapCard lat={profile!.homeLat!} lng={profile!.homeLng!} place={place} />
        ) : (
          <section className="flex flex-wrap items-center gap-4 rounded-card bg-action-wash p-5 ring-1 ring-action-deep/15">
            <MapPin aria-hidden className="size-6 shrink-0 text-action-deep" />
            <div className="min-w-[13rem] flex-1">
              <h2 className="font-semibold">Pin your gate once</h2>
              <p className="text-sm text-ink-2">Every booking will use it, and your driver goes straight to it at night.</p>
            </div>
            <Link
              href="/dashboard/customer/home-location"
              className="press inline-flex min-h-11 items-center rounded-full bg-selected px-5 text-[15px] font-semibold text-on-selected"
            >
              Set my home pin
            </Link>
          </section>
        )}

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-card bg-surface p-4 ring-1 ring-line">
            <dt className="text-sm text-ink-3">Pickups done</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{completed.length}</dd>
          </div>
          <div className="rounded-card bg-surface p-4 ring-1 ring-line">
            <dt className="flex items-center gap-1.5 text-sm text-ink-3">
              <Recycle aria-hidden className="size-4 text-action-deep" /> Bins collected
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{binsCollected}</dd>
          </div>
        </dl>

        {/* Asked only once there's a paid pickup on the way: then an alert is worth having. */}
        {active && active.status !== 'PENDING_PAYMENT' && (
          <div className="grid gap-4 empty:hidden">
            <EnableAlerts compact message="Want a message when a driver is assigned to this pickup and when your bins are collected?" />
            <InstallPrompt />
          </div>
        )}
      </div>
    </div>
  )
}
