import { redirect } from 'next/navigation'
import { Star } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { dateLabel } from '@/lib/format'
import { receiptNumber } from '@/lib/receipt-pdf'
import { driverStats, MISS_LABELS, STATS_DAYS, summarizeRatings } from '@/lib/ratings'
import { Card, CardTitle, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

// Outside the component: reads the clock once per request.
function since(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={`${size} ${n <= Math.round(value) ? 'fill-driver text-driver' : 'text-line-strong'}`} />
      ))}
    </span>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-ink-3">{note}</p>
    </div>
  )
}

// The driver's own numbers: ratings from customers, how many stops they accepted and collected, and the ones they missed.
export default async function DriverPerformancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const from = since(STATS_DAYS)
  const [allStars, recentRatings, accepted, misses, collected, missList] = await Promise.all([
    prisma.orderRating.findMany({ where: { driverId: user.id }, select: { stars: true } }),
    prisma.orderRating.findMany({
      where: { driverId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, stars: true, comment: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { actorId: user.id, reason: 'Driver accepted the stop', createdAt: { gte: from } },
      distinct: ['orderId'],
      select: { orderId: true },
    }),
    prisma.driverMiss.groupBy({ by: ['kind'], where: { driverId: user.id, createdAt: { gte: from } }, _count: { _all: true } }),
    prisma.ledgerEntry.count({ where: { driverId: user.id, type: 'driver_payout_pickup', createdAt: { gte: from } } }),
    prisma.driverMiss.findMany({
      where: { driverId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, kind: true, reason: true, shiftDate: true, createdAt: true, orderId: true },
    }),
  ])

  const missCount = (kind: string) => misses.find((m) => m.kind === kind)?._count._all ?? 0
  const stats = driverStats({
    accepted: accepted.length,
    declined: missCount('DECLINED'),
    expired: missCount('EXPIRED'),
    collected,
    notCollected: missCount('NOT_COLLECTED'),
  })
  const ratings = summarizeRatings(allStars.map((r) => r.stars))

  return (
    <div>
      <PageHeader title="Performance" lead={`How you're doing: customer ratings, and your stops over the last ${STATS_DAYS} days.`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card bg-surface p-5 ring-1 ring-action/40">
          <p className="text-sm text-ink-3">Your rating</p>
          {ratings.average == null ? (
            <p className="mt-1 text-[15px] text-ink-2">No ratings yet</p>
          ) : (
            <>
              <p className="mt-1 flex items-center gap-2">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-action">{ratings.average.toFixed(1)}</span>
                <Stars value={ratings.average} />
              </p>
              <p className="mt-0.5 text-sm text-ink-3">
                From {ratings.count} {ratings.count === 1 ? 'rating' : 'ratings'}
              </p>
            </>
          )}
        </div>
        <Tile
          label="Stops accepted"
          value={stats.acceptanceRate == null ? '–' : `${stats.acceptanceRate}%`}
          note={stats.offered ? `${stats.accepted} of ${stats.offered} offered` : 'No stops offered yet'}
        />
        <Tile
          label="Stops collected"
          value={stats.completionRate == null ? '–' : `${stats.completionRate}%`}
          note={
            stats.collected + stats.notCollected
              ? `${stats.collected} collected, ${stats.notCollected} left at shift end`
              : 'No stops to collect yet'
          }
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>What customers say</CardTitle>
          {ratings.count > 0 && (
            <ul className="mb-5 grid gap-1.5" aria-label="Ratings by stars">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = ratings.byStars[n - 1]
                return (
                  <li key={n} className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="text-ink-2">
                      {n} {n === 1 ? 'star' : 'stars'}
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-driver" style={{ width: `${(c / ratings.count) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-ink-3">{c}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {recentRatings.length === 0 ? (
            <p className="text-[15px] text-ink-3">Customers can rate a pickup once you&apos;ve collected it. Their ratings show here.</p>
          ) : (
            <ul className="-mx-1 divide-y divide-line">
              {recentRatings.map((r) => (
                <li key={r.id} className="px-1 py-3">
                  <span className="flex items-center justify-between gap-3">
                    <Stars value={r.stars} />
                    <span className="text-sm text-ink-3">{dateLabel(r.createdAt)}</span>
                  </span>
                  {r.comment && <p className="mt-1.5 text-[15px] text-ink-2">&ldquo;{r.comment}&rdquo;</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Missed stops</CardTitle>
          {missList.length === 0 ? (
            <p className="text-[15px] text-ink-3">None. Stops you decline, don&apos;t answer in time, or don&apos;t collect by shift end show here.</p>
          ) : (
            <ul className="-mx-1 divide-y divide-line">
              {missList.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-1 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{MISS_LABELS[m.kind] ?? m.kind}</span>
                    <span className="block text-sm text-ink-3">
                      {m.shiftDate ? `Night of ${dateLabel(m.shiftDate)}` : dateLabel(m.createdAt)} · {receiptNumber(m.orderId)}
                      {m.kind === 'DECLINED' && m.reason && ` · ${m.reason}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-ink-3">Declined and unanswered stops go to another driver straight away. Stops not collected move to the next night.</p>
        </Card>
      </div>
    </div>
  )
}
