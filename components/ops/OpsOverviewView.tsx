import Link from 'next/link'
import { ArrowRight, CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react'
import HeroCard from '@/components/kit/HeroCard'
import Chip from '@/components/kit/Chip'
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

// The ops overview, as designed: tonight's title with the main action, the live progress card, then
// "Needs you" beside the drivers online. Data comes from app/ops/page.tsx.
export default function OpsOverviewView({
  dateLine,
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
}: {
  dateLine: string // "Tuesday 14 October · shift 8:00pm – 6:00am"
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
}) {
  const needYou = waiting.reduce((n, a) => n + a.count, 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const stats = [
    { label: 'Waiting for a driver', value: waitingForDriver },
    { label: 'With a driver', value: withDriver },
    { label: 'Collected', value: collected },
    { label: 'Need you', value: needYou },
  ]

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{dateLine}</p>
          <h1 className="mt-1 text-[clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-tight tracking-[-0.03em]">Tonight</h1>
        </div>
        {planHref && (
          <Link
            href={planHref}
            className="press group inline-flex min-h-12 items-center gap-2 rounded-full bg-action px-6 text-[15px] font-semibold text-on-action shadow-card transition hover:shadow-lift"
          >
            Plan and assign <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {/* The live progress card */}
      <HeroCard aria-labelledby="progress" className="anim-rise grid gap-6 sm:p-7 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] lg:items-end">
        <div className="grid gap-3">
          <div className="flex items-center gap-2.5">
            <h2 id="progress" className="text-sm font-normal text-on-hero-2">
              Collected and unloaded
            </h2>
            {running && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-bold text-on-highlight">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-on-highlight" /> Live
              </span>
            )}
          </div>
          <p className="text-[clamp(2.4rem,4vw,3rem)] font-bold leading-none tracking-[-0.035em] tabular-nums">
            {done} <span className="text-xl font-medium tracking-normal text-on-hero-2">of {total}</span>
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label="Tonight's orders done"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full origin-left rounded-full bg-highlight transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <dl className="contents">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[13px] text-on-hero-2">{s.label}</dt>
              <dd className="mt-1 text-[26px] font-bold leading-none tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </HeroCard>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="attention" className="anim-rise grid gap-3 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
          <div className="flex items-center justify-between gap-3">
            <h2 id="attention" className="text-lg font-semibold tracking-tight">
              Needs you
            </h2>
            {waiting.some((a) => a.key === 'exceptions') && (
              <Link href="/ops/exceptions" className="min-h-11 content-center text-sm font-semibold text-action-deep underline underline-offset-4">
                Open exceptions
              </Link>
            )}
          </div>
          {waiting.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-[16px] bg-ok-wash p-4 text-[15px] font-semibold text-ok-deep">
              <CheckCircle2 aria-hidden className="size-5" /> All clear for now
            </p>
          ) : (
            <ul className="anim-stagger grid gap-2">
              {waiting.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="lift group flex items-center gap-3.5 rounded-[16px] bg-canvas px-4 py-3.5">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full ${
                        a.key === 'needsDriver' || a.key === 'exceptions' ? 'bg-danger-wash text-danger' : 'bg-action-wash text-action-deep'
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
        </section>

        <section aria-labelledby="drivers-online" className="anim-rise grid gap-1 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="drivers-online" className="text-lg font-semibold tracking-tight">
              Drivers online
            </h2>
            <span className="text-sm tabular-nums text-ink-3">
              {online} of {working} working tonight
            </span>
          </div>
          {drivers.length === 0 ? (
            <p className="rounded-[16px] bg-canvas p-4 text-[15px] text-ink-2">Nobody is online yet. Drivers go online when the shift starts.</p>
          ) : (
            <ul className="anim-stagger divide-y divide-line">
              {drivers.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-[13px] font-semibold ring-1 ring-line">
                    {d.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.name}</span>
                    <span className="block truncate text-sm text-ink-3">{[d.vehicle, d.status].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Chip tone={d.tone}>{d.tone === 'progress' ? 'On a trip' : d.tone === 'done' ? 'Done' : 'Waiting'}</Chip>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
