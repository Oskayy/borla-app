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
    <div className="max-w-5xl">
      <PageHeader
        title="Driver ratings"
        lead={`Customers rate pickups from 1 to 5 stars. Ratings of ${LOW_RATING} stars or fewer wait here until someone has looked into them.`}
      />

      <section className="rounded-card bg-surface p-5 ring-1 ring-line">
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

      <section className="mt-6 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="text-base font-semibold">Approved drivers</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[15px]">
            <thead className="text-sm text-ink-3">
              <tr>
                <th className="py-2 font-medium">Driver</th>
                <th className="py-2 font-medium">Average rating</th>
                <th className="py-2 text-right font-medium">Last {STATS_DAYS} days</th>
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
                  <td className="py-2.5 text-right tabular-nums">{d.misses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
