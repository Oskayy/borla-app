import { redirect } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import { History } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { dateLabel } from '@/lib/format'
import { binsText, type OrderSnapshot } from '@/lib/order-status'
import { receiptNumber } from '@/lib/receipt-pdf'
import { BackToAccount } from '@/components/driver/AccountRow'
import { Chip } from '@/components/ops/kit'

export const dynamic = 'force-dynamic'

const DAYS = 90

// Reads the clock: outside the component.
function since() {
  return new Date(Date.now() - DAYS * 86_400_000)
}

interface Stop {
  id: string
  night: Date
  address: string
  bins: string
  pickup: number
  unload: number
}

// Every stop the driver was paid for in the last 90 days, by night, with what each one paid.
export default async function DriverTripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const entries = await prisma.ledgerEntry.findMany({
    where: { driverId: user.id, type: { in: ['driver_payout_pickup', 'driver_payout_disposal'] }, createdAt: { gte: since() } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { type: true, amount: true, createdAt: true, order: { select: { id: true, shiftDate: true, quoteSnapshot: true } } },
  })

  // One row per stop (both shares added up), grouped by the night it was collected.
  const stops = new Map<string, Stop>()
  for (const e of entries) {
    const snap = e.order.quoteSnapshot as OrderSnapshot | null
    const s = stops.get(e.order.id) ?? {
      id: e.order.id,
      night: e.order.shiftDate ?? e.createdAt,
      address: snap?.address ?? 'Stop',
      bins: binsText(snap),
      pickup: 0,
      unload: 0,
    }
    if (e.type === 'driver_payout_pickup') s.pickup += e.amount
    else s.unload += e.amount
    stops.set(e.order.id, s)
  }
  const nights = new Map<string, Stop[]>()
  for (const s of stops.values()) {
    const key = s.night.toISOString().slice(0, 10)
    nights.set(key, [...(nights.get(key) ?? []), s])
  }

  return (
    <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <BackToAccount />
        <h1 className="anim-rise text-[clamp(1.75rem,2.8vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.03em]">Trip history</h1>
        <p className="mt-1 text-sm text-ink-3">The last {DAYS} days.</p>
      </div>

      {nights.size === 0 ? (
        <EmptyState icon={History} title="No trips yet" text="Your paid stops show here, night by night, once you collect and unload." />
      ) : (
        [...nights.entries()].map(([night, list]) => {
          const total = list.reduce((n, s) => n + s.pickup + s.unload, 0)
          return (
            <section key={night} aria-label={`Night of ${dateLabel(night)}`} className="rounded-card bg-surface shadow-card ring-1 ring-line/70">
              <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <h2 className="font-semibold">Night of {dateLabel(night)}</h2>
                <span className="text-sm tabular-nums text-ink-3">
                  {list.length} {list.length === 1 ? 'stop' : 'stops'} · <span className="font-semibold text-ink">GHS {total.toFixed(2)}</span>
                </span>
              </div>
              <ul className="divide-y divide-line">
                {list.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{s.address}</span>
                      <span className="block text-sm text-ink-3">
                        {s.bins || 'Bins'} · {receiptNumber(s.id)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">GHS {(s.pickup + s.unload).toFixed(2)}</span>
                      {s.unload > 0 ? <Chip tone="ops">Unloaded</Chip> : <Chip tone="driver">Unload pending</Chip>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
