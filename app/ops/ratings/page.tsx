import { redirect } from 'next/navigation'
import { Star } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { EXCEPTION_ROLES } from '@/lib/exceptions'
import { dateLabel } from '@/lib/format'
import { receiptNumber } from '@/lib/receipt-pdf'
import { LOW_RATING, STATS_DAYS } from '@/lib/ratings'
import ReviewRatingButton from '@/components/ops/ReviewRatingButton'
import { PageHeader } from '@/components/ui'
import { Card, Kpi } from '@/components/ops/kit'
import { BarChart, Sparkline } from '@/components/ops/charts'
import { starSpread, weeklyAverages, weeklyCounts } from '@/lib/ops-stats'

export const dynamic = 'force-dynamic'

// Outside the component: reads the clock once per request.
function since(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={`size-4 ${n <= Math.round(value) ? 'fill-warn text-warn' : 'text-line-strong'}`} />
      ))}
    </span>
  )
}

// Customer ratings of drivers: low ones to look into, and each driver's average and missed stops.
export default async function OpsRatingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
  if (!me || !EXCEPTION_ROLES.includes(me.role)) redirect('/ops')

  const from = since(STATS_DAYS)
  const [toReview, allTime, recent, misses, drivers] = await Promise.all([
    prisma.orderRating.findMany({
      where: { stars: { lte: LOW_RATING }, reviewedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        stars: true,
        comment: true,
        createdAt: true,
        orderId: true,
        driver: { select: { name: true } },
        order: { select: { shiftDate: true, quoteSnapshot: true, customer: { select: { name: true, phone: true } } } },
      },
    }),
    prisma.orderRating.groupBy({ by: ['driverId'], _avg: { stars: true }, _count: { _all: true } }),
    prisma.orderRating.groupBy({ by: ['driverId'], where: { createdAt: { gte: from } }, _avg: { stars: true }, _count: { _all: true } }),
    prisma.driverMiss.groupBy({ by: ['driverId'], where: { createdAt: { gte: from } }, _count: { _all: true } }),
    prisma.user.findMany({ where: { role: 'DRIVER', driverProfile: { is: { approvalStatus: 'APPROVED' } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  // Charts: the last 60 days of ratings (this 30 and the 30 before) and four weeks of missed stops.
  const now = new Date()
  const sixty = await prisma.orderRating.findMany({ where: { createdAt: { gte: since(60) } }, select: { driverId: true, stars: true, createdAt: true } })
  const missDates = await prisma.driverMiss.findMany({ where: { createdAt: { gte: since(28) } }, select: { createdAt: true } })
  const thisMonth = sixty.filter((r) => r.createdAt >= from)
  const before = sixty.filter((r) => r.createdAt < from)
  const mean = (xs: { stars: number }[]) => (xs.length ? xs.reduce((n, r) => n + r.stars, 0) / xs.length : null)
  const avgNow = mean(thisMonth)
  const avgBefore = mean(before)
  const change = avgNow != null && avgBefore != null ? Math.round((avgNow - avgBefore) * 10) / 10 : null
  const spread = starSpread(thisMonth.map((r) => r.stars))
  const topCount = Math.max(...spread.map((x) => x.count), 1)
  const trend = weeklyAverages(sixty, now)
  const missWeeks = weeklyCounts(missDates.map((m) => m.createdAt), now)

  type Agg = { driverId: string; _avg: { stars: number | null }; _count: { _all: number } }
  const summary = (list: Agg[], id: string) => {
    const g = list.find((x) => x.driverId === id)
    return { count: g?._count._all ?? 0, average: g?._avg.stars == null ? null : Math.round(g._avg.stars * 10) / 10 }
  }
  const rows = drivers.map((d) => ({
    ...d,
    all: summary(allTime, d.id),
    recent: summary(recent, d.id),
    misses: misses.find((m) => m.driverId === d.id)?._count._all ?? 0,
  }))

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        title="Driver ratings"
        lead={`Customers rate pickups from 1 to 5 stars. Ratings of ${LOW_RATING} stars or fewer wait here until someone has looked into them.`}
      />

      <div className="anim-stagger mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <Kpi
          hero
          label={`Average rating, last ${STATS_DAYS} days`}
          value={avgNow != null ? avgNow.toFixed(1) : '—'}
          unit={avgNow != null ? '★' : undefined}
          note={change == null ? `${thisMonth.length} ratings` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)} vs the ${STATS_DAYS} days before · ${thisMonth.length} ratings`}
          tone={change != null && change < 0 ? 'bad' : 'good'}
        />
        <Card id="spread" title="How customers rated" sub={`Last ${STATS_DAYS} days`}>
          <ul className="grid gap-2.5">
            {spread.map((x) => (
              <li key={x.stars} className="flex items-center gap-3 text-sm">
                <span className="w-8 tabular-nums">{x.stars} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                  <span className={`block h-full rounded-full ${x.stars <= LOW_RATING ? 'bg-danger' : 'bg-action'}`} style={{ width: `${(x.count / topCount) * 100}%` }} />
                </span>
                <b className="w-8 text-right tabular-nums">{x.count}</b>
              </li>
            ))}
          </ul>
        </Card>
        <Card id="missed" title="Missed stops" sub="Per week, last 4 weeks">
          <BarChart data={missWeeks} label="Missed stops per week" />
        </Card>
      </div>

      <section className="rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
        <h2 className="text-base font-semibold">Low ratings to review ({toReview.length})</h2>
        {toReview.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-3">Nothing to review.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {toReview.map((r) => {
              const address = (r.order.quoteSnapshot as { address?: string } | null)?.address
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Stars value={r.stars} />
                      <span className="font-semibold">{r.driver.name}</span>
                      <span className="text-sm text-ink-3">
                        · {receiptNumber(r.orderId)} · {r.order.shiftDate ? `night of ${dateLabel(r.order.shiftDate)}` : dateLabel(r.createdAt)}
                      </span>
                    </p>
                    {r.comment ? (
                      <p className="mt-1.5 text-[15px]">&ldquo;{r.comment}&rdquo;</p>
                    ) : (
                      <p className="mt-1.5 text-[15px] text-ink-3">No comment.</p>
                    )}
                    <p className="mt-1 text-sm text-ink-3">
                      Customer: {r.order.customer.name} · {r.order.customer.phone}
                      {address && ` · ${address}`}
                    </p>
                  </div>
                  <ReviewRatingButton ratingId={r.id} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
        <h2 className="text-base font-semibold">Approved drivers</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[15px]">
            <thead className="text-sm text-ink-3">
              <tr>
                <th className="py-2 font-medium">Driver</th>
                <th className="py-2 font-medium">Average rating</th>
                <th className="py-2 text-right font-medium">Last {STATS_DAYS} days</th>
                <th className="py-2 text-right font-medium">Trend (5 weeks)</th>
                <th className="py-2 text-right font-medium">Missed stops ({STATS_DAYS} days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="py-2.5 font-medium">{d.name}</td>
                  <td className="py-2.5">
                    {d.all.average == null ? (
                      <span className="text-ink-3">No ratings</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{d.all.average.toFixed(1)}</span>
                        <Stars value={d.all.average} />
                        <span className="text-sm text-ink-3">({d.all.count})</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{d.recent.average == null ? '–' : `${d.recent.average.toFixed(1)} (${d.recent.count})`}</td>
                  <td className="py-2.5">
                    <span className="flex justify-end">
                      <Sparkline values={trend.get(d.id) ?? []} label={`${d.name}, weekly rating`} bad={(d.recent.average ?? 5) < 4} />
                    </span>
                  </td>
                  <td className={`py-2.5 text-right tabular-nums ${d.misses ? 'font-semibold text-danger' : ''}`}>{d.misses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
