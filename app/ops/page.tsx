import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Flag, Moon, Route, Star, Undo2, Wallet, type LucideIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, isWithinShift, localParts, windowLabel } from '@/lib/shift'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { worksNight } from '@/lib/availability'
import { REFUND_ROLES } from '@/lib/refunds'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { OPS_SECTIONS, canOpen, type QueueKey } from '@/lib/ops-nav'
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

// Stages of tonight's orders, each in the colour of whose hands it is in (the Legend Rule).
const STAGES = [
  { key: 'waiting', label: 'Waiting for a driver', bar: 'bg-customer', statuses: ['PAID', 'READY_FOR_BATCH'] },
  { key: 'withDriver', label: 'With a driver', bar: 'bg-driver', statuses: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW'] },
  { key: 'collected', label: 'Collected, not unloaded', bar: 'bg-driver-deep', statuses: ['PICKED_UP', 'DISPOSAL_PENDING'] },
  { key: 'unloaded', label: 'Unloaded and verified', bar: 'bg-ops', statuses: ['DISPOSAL_VERIFIED', 'COMPLETED'] },
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.6rem,2.4vw,2rem)] font-bold leading-tight tracking-[-0.025em]">Tonight, {label}</h1>
          <p className="mt-1 text-[15px] text-ink-2">What needs a person comes first, then how the night is going.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line">
          <Moon aria-hidden className="size-4 text-ops" />
          {running ? 'Shift running' : 'Shift'} · {windowLabel(settings)}
        </span>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="attention" className="rounded-card bg-surface ring-1 ring-line">
          <h2 id="attention" className="px-5 pt-5 text-base font-semibold tracking-tight sm:px-6">
            Needs attention
          </h2>
          {waiting.length === 0 ? (
            <p className="flex items-center gap-2.5 px-5 pb-6 pt-3 text-[15px] text-ink-2 sm:px-6">
              <CheckCircle2 aria-hidden className="size-5 text-ops" /> All clear. Nothing is waiting for you right now.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {waiting.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-canvas sm:px-6">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full ${
                        a.key === 'needsDriver' || a.key === 'exceptions' ? 'bg-danger-wash text-danger' : 'bg-ops-wash text-ops-deep'
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

        <div className="grid gap-6">
          <section aria-labelledby="orders" className="rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="orders" className="text-base font-semibold tracking-tight">
                Tonight&apos;s orders
              </h2>
              <span className="text-2xl font-bold tabular-nums tracking-tight">{totalTonight}</span>
            </div>
            {totalTonight > 0 && (
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
                {stageCounts
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <span key={s.key} className={`${s.bar} h-full`} style={{ width: `${(s.count / totalTonight) * 100}%` }} />
                  ))}
              </div>
            )}
            <dl className="mt-4 grid gap-2.5 text-[15px]">
              {stageCounts.map((s) => (
                <div key={s.key} className="flex items-center gap-3">
                  <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${s.bar}`} />
                  <dt className="flex-1 text-ink-2">{s.label}</dt>
                  <dd className="font-semibold tabular-nums">{s.count}</dd>
                </div>
              ))}
            </dl>
            {totalTonight === 0 && <p className="mt-3 text-sm text-ink-3">No orders booked for tonight yet.</p>}
          </section>

          <section aria-labelledby="drivers" className="rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
            <h2 id="drivers" className="text-base font-semibold tracking-tight">
              Drivers
            </h2>
            <dl className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-ink-3">Online now</dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{online}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-3">Working tonight</dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{working}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-3">Approved</dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{drivers.length}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
