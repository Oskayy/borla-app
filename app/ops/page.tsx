import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Flag, Landmark, Moon, Route, Star, Undo2, Wallet, type LucideIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, isWithinShift, localParts, windowLabel } from '@/lib/shift'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { worksNight } from '@/lib/availability'
import { REFUND_ROLES } from '@/lib/refunds'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { OPS_SECTIONS, canOpen, type QueueKey } from '@/lib/ops-nav'
import HeroCard from '@/components/kit/HeroCard'
import { queueCounts } from '@/lib/ops-queue'

export const dynamic = 'force-dynamic'

interface Attention {
  key: string
  count: number
  title: (n: number) => string
  hint: string
  href: string
  icon: LucideIcon
}

// Ordered by urgency during the night: stops without a driver first, money last.
const QUEUE_ROWS: (Omit<Attention, 'count'> & { queue: QueueKey })[] = [
  { key: 'needsDriver', queue: 'needsDriver', title: (n) => `${n} ${n === 1 ? 'order needs' : 'orders need'} a driver`, hint: 'Paid for tonight and not on anyone’s list yet.', href: '/ops/assign', icon: Route },
  { key: 'exceptions', queue: 'exceptions', title: (n) => `${n} ${n === 1 ? 'exception' : 'exceptions'}`, hint: 'Failed pickups, disputes, pickup checks and payment problems.', href: '/ops/exceptions', icon: AlertTriangle },
  { key: 'unloads', queue: 'unloads', title: (n) => `${n} ${n === 1 ? 'unload' : 'unloads'} to check`, hint: 'The site check couldn’t confirm these; the driver’s unload share waits on you.', href: '/ops/disposal-review', icon: Flag },
  { key: 'approvals', queue: 'approvals', title: (n) => `${n} driver ${n === 1 ? 'approval' : 'approvals'}`, hint: 'New drivers and vehicle changes waiting for a decision.', href: '/ops/driver-approvals', icon: BadgeCheck },
  { key: 'lowRatings', queue: 'lowRatings', title: (n) => `${n} low ${n === 1 ? 'rating' : 'ratings'}`, hint: 'Customers gave 2 stars or fewer.', href: '/ops/ratings', icon: Star },
  { key: 'withdrawals', queue: 'withdrawals', title: (n) => `${n} ${n === 1 ? 'withdrawal' : 'withdrawals'} open`, hint: 'Driver payouts to approve, confirm or check.', href: '/ops/withdrawals', icon: Wallet },
  { key: 'finance', queue: 'finance', title: (n) => `${n} money ${n === 1 ? 'item' : 'items'} to check`, hint: 'Settlements to confirm in the bank, or a daily money check that found a difference.', href: '/ops/finance', icon: Landmark },
]

// Reads the clock: outside the component so the render stays pure.
const span = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`)

// Reads the clock: outside the component.
function urgency(settings: Awaited<ReturnType<typeof getShiftSettings>>, oldest: Date | null): string | null {
  const now = new Date()
  const toCutoff = (settings.hardCutoffMinutes - localParts(now, settings.timezone).minutes + 1440) % 1440
  const parts = [] as string[]
  if (oldest) parts.push(`oldest waiting ${span(Math.max(0, Math.round((now.getTime() - oldest.getTime()) / 60000)))}`)
  if (toCutoff <= 6 * 60) parts.push(`late-order cutoff in ${span(toCutoff)}`)
  return parts.length ? parts.join(' · ') : null
}

function tonightInfo(settings: Awaited<ReturnType<typeof getShiftSettings>>) {
  const now = new Date()
  const night = planningShiftDate(now, settings)
  const label = new Date(`${night}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
  return { night, label, running: isWithinShift(now, settings) }
}

// Drivers who count as online right now (online and inside the shift, or with an ops override).
function onlineNow(drivers: { isOnline: boolean; onlineOverrideUntil: Date | null }[], settings: Awaited<ReturnType<typeof getShiftSettings>>) {
  const now = new Date()
  return drivers.filter((d) => isDriverAvailable(d, now, settings)).length
}

// Stages of tonight's orders in the shared status colours (on the dark card): sky = waiting on Trashit,
// amber = with a driver, light amber = collected, white = done.
const STAGES = [
  { key: 'waiting', label: 'Waiting for a driver', bar: 'bg-highlight', statuses: ['PAID', 'READY_FOR_BATCH'] },
  { key: 'withDriver', label: 'With a driver', bar: 'bg-warn', statuses: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW'] },
  { key: 'collected', label: 'Collected, not unloaded', bar: 'bg-warn/55', statuses: ['PICKED_UP', 'DISPOSAL_PENDING'] },
  { key: 'unloaded', label: 'Unloaded and verified', bar: 'bg-white', statuses: ['DISPOSAL_VERIFIED', 'COMPLETED'] },
] as const

export default async function OpsOverview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true } })
  if (!me) redirect('/login')

  const settings = await getShiftSettings()
  const { night, label, running } = tonightInfo(settings)
  const canRefund = REFUND_ROLES.includes(me.role)
  const canPay = PAYOUT_ROLES.includes(me.role)

  // One batch on one connection (see lib/ops-queue.ts: parallel queries here used up the pool).
  const counts = await queueCounts(me.role)
  const byStatus = await prisma.order.groupBy({ by: ['status'], where: { shiftDate: dbDate(night) }, _count: { _all: true } })
  const [drivers, refundsToApprove, paymentsToConfirm] = await prisma.$transaction([
    prisma.driverProfile.findMany({
      where: { approvalStatus: 'APPROVED', isActive: true, user: { active: true } },
      select: { isOnline: true, onlineOverrideUntil: true, workNights: true, nightsOff: true },
    }),
    prisma.refund.count({ where: canRefund ? { status: 'AWAITING_APPROVAL' } : { id: 'none' } }),
    prisma.withdrawal.count({ where: canPay ? { status: 'CONFIRMING' } : { id: 'none' } }),
  ])

  const allowed = new Set(OPS_SECTIONS.flatMap((s) => s.links).filter((l) => canOpen(l, me.role)).map((l) => l.href))
  const attention: Attention[] = QUEUE_ROWS.filter((r) => allowed.has(r.href)).map((r) => ({ ...r, count: counts[r.queue] }))
  if (canRefund) {
    attention.push({
      key: 'refunds',
      count: refundsToApprove,
      title: (n) => `${n} ${n === 1 ? 'refund needs' : 'refunds need'} a second approver`,
      hint: 'Staff refunds of GHS 100 or more. The person who asked can’t approve their own.',
      href: '/ops/exceptions',
      icon: Undo2,
    })
  }
  if (canPay) {
    attention.push({
      key: 'confirming',
      count: paymentsToConfirm,
      title: (n) => `${n} manual ${n === 1 ? 'payment' : 'payments'} to confirm`,
      hint: 'Marked paid by one finance user; a different one confirms.',
      href: '/ops/withdrawals',
      icon: Wallet,
    })
  }
  if (counts.needsDriver > 0) {
    const oldest = await prisma.order.findFirst({ where: { status: 'PAID', driverId: null }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    const when = urgency(settings, oldest?.createdAt ?? null)
    const row = attention.find((a) => a.key === 'needsDriver')
    if (row && when) row.hint = `${when.charAt(0).toUpperCase()}${when.slice(1)}.`
  }
  const waiting = attention.filter((a) => a.count > 0)

  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: byStatus.filter((b) => (s.statuses as readonly string[]).includes(b.status)).reduce((n, b) => n + b._count._all, 0),
  }))
  const totalTonight = stageCounts.reduce((n, s) => n + s.count, 0)
  const working = drivers.filter((d) => worksNight(d, night)).length
  const online = onlineNow(drivers, settings)

  const done = stageCounts.find((s) => s.key === 'unloaded')?.count ?? 0

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[clamp(1.6rem,2.4vw,2rem)] font-bold leading-tight tracking-[-0.025em]">Tonight, {label}</h1>
        <p className="mt-1 text-[15px] text-ink-2">How the night is going, then what needs a person.</p>
      </div>

      {/* The live progress card: tonight's orders by stage, and drivers online. */}
      <HeroCard aria-labelledby="orders" className="anim-rise grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-on-hero-2">
              <Moon aria-hidden className="size-4 text-highlight" /> {running ? 'Shift running' : 'Shift'} · {windowLabel(settings)}
            </p>
            {running && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-highlight">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-highlight" /> Live
              </span>
            )}
          </div>
          <h2 id="orders" className="flex flex-wrap items-baseline gap-x-3 text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none tracking-tight">
            <span className="tabular-nums">{done}</span>
            <span className="text-lg font-semibold text-on-hero-2">
              of {totalTonight} {totalTonight === 1 ? 'order' : 'orders'} done
            </span>
          </h2>
          {totalTonight > 0 ? (
            <div className="flex h-3 overflow-hidden rounded-full bg-white/12" aria-hidden>
              {stageCounts
                .filter((s) => s.count > 0)
                .map((s) => (
                  <span key={s.key} className={`${s.bar} h-full transition-[width] duration-700`} style={{ width: `${(s.count / totalTonight) * 100}%` }} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-on-hero-2">No orders booked for tonight yet.</p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {stageCounts.map((s) => (
              <div key={s.key}>
                <dt className="flex items-center gap-1.5 text-on-hero-2">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${s.bar}`} /> {s.label}
                </dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums">{s.count}</dd>
              </div>
            ))}
          </dl>
        </div>
        <dl aria-label="Drivers" className="grid grid-cols-3 content-start gap-3 rounded-[18px] bg-white/6 p-4 lg:grid-cols-1">
          <div>
            <dt className="text-sm text-on-hero-2">Online now</dt>
            <dd className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight text-highlight">{online}</dd>
          </div>
          <div>
            <dt className="text-sm text-on-hero-2">Working tonight</dt>
            <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{working}</dd>
          </div>
          <div>
            <dt className="text-sm text-on-hero-2">Approved</dt>
            <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{drivers.length}</dd>
          </div>
        </dl>
      </HeroCard>

      <section aria-labelledby="attention" className="rounded-card bg-surface ring-1 ring-line">
        <h2 id="attention" className="flex items-center gap-2 px-5 pt-5 text-base font-semibold tracking-tight sm:px-6">
          Needs you
          {waiting.length > 0 && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold tabular-nums text-white">{waiting.reduce((n, a) => n + a.count, 0)}</span>
          )}
        </h2>
        {waiting.length === 0 ? (
          <p className="flex items-center gap-2.5 px-5 pb-6 pt-3 text-[15px] text-ink-2 sm:px-6">
            <CheckCircle2 aria-hidden className="size-5 text-ok-deep" /> All clear. Nothing is waiting for you right now.
          </p>
        ) : (
          <ul className="anim-stagger grid gap-2 p-3 pt-2 sm:grid-cols-2">
            {waiting.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="lift group flex h-full items-center gap-4 rounded-[18px] bg-canvas px-4 py-4">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full ${
                      a.key === 'needsDriver' || a.key === 'exceptions' ? 'bg-danger-wash text-danger' : 'bg-action-wash text-action-deep'
                    }`}
                  >
                    <a.icon aria-hidden className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold tabular-nums">{a.title(a.count)}</span>
                    <span className="block text-sm text-ink-3">{a.hint}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
