import Link from 'next/link'
import { ArrowRight, CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react'
import Chip from '@/components/kit/Chip'
import { Card, Kpi } from '@/components/ops/kit'
import { BarChart, Donut, Gauge } from '@/components/ops/charts'
import type { StatusTone } from '@/lib/order-status'

export interface OverviewAttention {
  key: string
  count: number
  text: string // "3 orders need a driver"
  hint: string
  href: string
  icon: LucideIcon
}

export interface OverviewDriver {
  id: string
  name: string
  vehicle: string | null
  status: string // "Trip 1 · 2 to collect", "Waiting for stops"
  tone: StatusTone
}

const ghs = (n: number) => `GHS ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

// The ops overview (approved design, 18 Oct 2026): a greeting with the main action, four headline tiles (tonight's
// progress as the dark one), pickups over the week beside drivers online, then "Needs you", tonight's orders by zone
// and who is working. Data comes from app/ops/page.tsx.
export default function OpsOverviewView({
  dateLine,
  firstName,
  running,
  planHref,
  done,
  total,
  withDriver,
  collected,
  waitingForDriver,
  online,
  working,
  waiting,
  drivers,
  week,
  byZone,
  bookedGhs,
}: {
  dateLine: string // "Tuesday 14 October · shift 8:00pm – 6:00am"
  firstName: string
  running: boolean
  planHref: string | null // the main action, when this role can plan
  done: number
  total: number
  withDriver: number
  collected: number
  waitingForDriver: number
  online: number
  working: number
  waiting: OverviewAttention[]
  drivers: OverviewDriver[]
  week: { label: string; value: number }[]
  byZone: { label: string; value: number }[]
  bookedGhs: number | null // null: this role doesn't see money
}) {
  const needYou = waiting.reduce((n, a) => n + a.count, 0)
  const urgent = waiting.filter((a) => a.key === 'needsDriver' || a.key === 'exceptions').reduce((n, a) => n + a.count, 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const onTrip = drivers.filter((d) => d.tone === 'progress').length
  const finished = drivers.filter((d) => d.tone === 'done').length
  const lastWeek = week.length > 1 ? week[0].value : 0

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{dateLine}</p>
          <h1 className="mt-1 text-[clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-tight tracking-[-0.03em]">Good evening, {firstName}</h1>
        </div>
        {planHref && (
          <Link
            href={planHref}
            className="press group inline-flex min-h-12 items-center gap-2 rounded-full bg-hero px-6 text-[15px] font-semibold text-on-hero shadow-card transition hover:shadow-lift"
          >
            Plan and assign <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="anim-stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <Kpi hero label="Collected and unloaded" value={done} unit={`of ${total}`} note={running ? `Live · ${pct}%` : `${pct}%`}>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label="Tonight's orders done"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-highlight transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        </Kpi>
        <Kpi label="Waiting for a driver" value={waitingForDriver} note={`${withDriver} with a driver · ${collected} collected`} />
        {bookedGhs != null ? (
          <Kpi label="Booked for tonight" value={ghs(bookedGhs)} note={`${total} ${total === 1 ? 'order' : 'orders'}`} />
        ) : (
          <Kpi label="Orders tonight" value={total} note={`${done} done`} />
        )}
        <Kpi label="Need you" value={needYou} note={urgent ? `${urgent} urgent` : needYou ? 'Nothing urgent' : 'All clear'} tone={urgent ? 'bad' : needYou ? 'plain' : 'good'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card id="week" title="Pickups this week" sub={running ? 'Collected per night · tonight still running' : 'Collected per night'}>
          <BarChart data={week} label="Pickups collected per night" />
          {week.length > 1 && <p className="sr-only">Seven nights ago: {lastWeek}.</p>}
        </Card>
        <Card id="online" title="Drivers online">
          <Gauge value={online} max={Math.max(working, online)} centre={`${online} of ${Math.max(working, online)}`} sub="working tonight" label="Drivers online" />
          <dl className="mt-1 grid grid-cols-3 text-center">
            {[
              ['On a trip', onTrip],
              ['Done', finished],
              ['Waiting', online - onTrip - finished],
            ].map(([l, v]) => (
              <div key={l as string}>
                <dd className="font-bold tabular-nums">{v}</dd>
                <dt className="text-xs text-ink-3">{l}</dt>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card
          id="attention"
          title="Needs you"
          action={
            waiting.some((a) => a.key === 'exceptions') ? (
              <Link href="/ops/exceptions" className="min-h-11 content-center text-sm font-semibold text-action-deep underline underline-offset-4">
                Open exceptions
              </Link>
            ) : undefined
          }
        >
          {waiting.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-[16px] bg-ok-wash p-4 text-[15px] font-semibold text-ok-deep">
              <CheckCircle2 aria-hidden className="size-5" /> All clear for now
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {waiting.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-3.5 py-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${
                        a.key === 'needsDriver' || a.key === 'exceptions' ? 'bg-danger-wash text-danger' : 'bg-canvas text-ink-2'
                      }`}
                    >
                      <a.icon aria-hidden className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tabular-nums">{a.text}</span>
                      <span className="block truncate text-sm text-ink-3">{a.hint}</span>
                    </span>
                    {a.key === 'needsDriver' || a.key === 'exceptions' ? <Chip tone="problem">Needs you</Chip> : null}
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4">
        <Card id="zones" title="Tonight's orders by zone">
          {byZone.length === 0 ? (
            <p className="rounded-[16px] bg-canvas p-4 text-[15px] text-ink-2">No orders for tonight yet.</p>
          ) : (
            <Donut parts={byZone} centre={String(total)} sub={total === 1 ? 'order' : 'orders'} label="Tonight's orders by zone" />
          )}
        </Card>

        <Card id="working" title="Who's working" action={<span className="text-sm tabular-nums text-ink-3">{online} online</span>} >
          {drivers.length === 0 ? (
            <p className="rounded-[16px] bg-canvas p-4 text-[15px] text-ink-2">Nobody is online yet. Drivers go online when the shift starts.</p>
          ) : (
            <ul className="divide-y divide-line">
              {drivers.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-action-wash text-[13px] font-semibold text-action-deep">{initials(d.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.name}</span>
                    <span className="block truncate text-sm text-ink-3">{[d.vehicle, d.status].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Chip tone={d.tone}>{d.tone === 'progress' ? 'On a trip' : d.tone === 'done' ? 'Done' : 'Waiting'}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>
      </div>
    </div>
  )
}
