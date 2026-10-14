import { redirect } from 'next/navigation'
import { AlertTriangle, BadgeCheck, Flag, Landmark, Route, Star, Undo2, Wallet, type LucideIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, isWithinShift, localParts, windowLabel } from '@/lib/shift'
import { dbDate, planningShiftDate } from '@/lib/schedule'
import { worksNight } from '@/lib/availability'
import { REFUND_ROLES } from '@/lib/refunds'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { OPS_SECTIONS, canOpen, type QueueKey } from '@/lib/ops-nav'
import OpsOverviewView from '@/components/ops/OpsOverviewView'
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
function onlineNow<T extends { isOnline: boolean; onlineOverrideUntil: Date | null }>(drivers: T[], settings: Awaited<ReturnType<typeof getShiftSettings>>): T[] {
  const now = new Date()
  return drivers.filter((d) => isDriverAvailable(d, now, settings))
}

// Stages of tonight's orders.
const STAGES = [
  { key: 'waiting', statuses: ['PAID', 'READY_FOR_BATCH'] },
  { key: 'withDriver', statuses: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW'] },
  { key: 'collected', statuses: ['PICKED_UP', 'DISPOSAL_PENDING'] },
  { key: 'unloaded', statuses: ['DISPOSAL_VERIFIED', 'COMPLETED'] },
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
      select: {
        userId: true,
        isOnline: true,
        onlineOverrideUntil: true,
        workNights: true,
        nightsOff: true,
        vehicleType: true,
        vehicleTypeRef: { select: { name: true } },
        user: { select: { name: true } },
      },
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
  const onlineDrivers = onlineNow(drivers, settings)
  const online = onlineDrivers.length

  // What each driver online is doing tonight.
  const theirs = onlineDrivers.length
    ? await prisma.order.findMany({
        where: { shiftDate: dbDate(night), driverId: { in: onlineDrivers.map((d) => d.userId) }, status: { in: ['ASSIGNED', 'PICKED_UP', 'DISPOSAL_PENDING', 'DISPOSAL_VERIFIED', 'COMPLETED'] } },
        select: { driverId: true, status: true },
      })
    : []
  const driverRows = onlineDrivers
    .map((d) => {
      const mine = theirs.filter((o) => o.driverId === d.userId)
      const toCollect = mine.filter((o) => o.status === 'ASSIGNED').length
      const onBoard = mine.filter((o) => o.status === 'PICKED_UP').length
      const status =
        toCollect > 0 ? `${toCollect} to collect${onBoard ? `, ${onBoard} on board` : ''}` : onBoard > 0 ? `${onBoard} on board, to unload` : mine.length > 0 ? `${mine.length} done tonight` : 'Waiting for stops'
      const tone = toCollect + onBoard > 0 ? ('progress' as const) : mine.length > 0 ? ('done' as const) : ('neutral' as const)
      return { id: d.userId, name: d.user.name, vehicle: d.vehicleTypeRef?.name ?? d.vehicleType, status, tone }
    })
    .sort((a, b) => (a.tone === b.tone ? a.name.localeCompare(b.name) : a.tone === 'progress' ? -1 : b.tone === 'progress' ? 1 : 0))

  const count = (key: string) => stageCounts.find((s) => s.key === key)?.count ?? 0

  return (
    <OpsOverviewView
      dateLine={`${label} · shift ${windowLabel(settings)}`}
      running={running}
      planHref={allowed.has('/ops/assign') ? '/ops/assign' : null}
      done={count('unloaded')}
      total={totalTonight}
      waitingForDriver={count('waiting')}
      withDriver={count('withDriver')}
      collected={count('collected')}
      online={online}
      working={working}
      waiting={waiting.map(({ key, count, title, hint, href, icon }) => ({ key, count, text: title(count), hint, href, icon }))}
      drivers={driverRows}
    />
  )
}
