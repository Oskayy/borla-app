import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { CUSTOMER_STAGES, type CustomerStatus } from '@/lib/order-status'
import Chip from '@/components/kit/Chip'

// Small building blocks shared by the app screens. They use the platform tokens, which each workspace sets
// (customers: clean green, drivers: evergreen, ops: moss). More shared pieces live in components/kit.

// The one page title, the same on every page: an optional back link and context line, the title, a short lead,
// and the page's main action on the right.
export const PAGE_TITLE = 'text-[clamp(1.75rem,2.8vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.03em]'

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group -ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-ink-2 hover:text-ink">
      <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" /> {children}
    </Link>
  )
}

export function PageHeader({
  title,
  lead,
  action,
  context,
  back,
}: {
  title: string
  lead?: React.ReactNode
  action?: React.ReactNode
  context?: React.ReactNode // a short line above the title, e.g. the date and shift
  back?: { href: string; label: string }
}) {
  return (
    <div className="anim-rise mb-7">
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {context && <p className="mb-1 text-sm text-ink-3">{context}</p>}
          <h1 className={PAGE_TITLE}>{title}</h1>
          {lead && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">{lead}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

// Content blocks: the surface colour, a soft shadow and a hairline edge, so they lift off the ground.
export const CARD = 'rounded-card bg-surface shadow-card ring-1 ring-line/70'

export function Card({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`${CARD} p-5 sm:p-6 ${className}`}>{children}</section>
}

// When a list has nothing in it yet: a tinted icon, what will appear here, and (optionally) what to do.
export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className={`${CARD} anim-rise grid place-items-center gap-1 px-6 py-12 text-center`}>
      <span className="mb-3 grid size-14 place-items-center rounded-full bg-action-wash text-action-deep">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      <p className="max-w-[42ch] text-[15px] text-ink-2">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function StatusPill({ status }: { status: CustomerStatus }) {
  return <Chip tone={status.tone}>{status.label}</Chip>
}

// Booked → Driver assigned → Collected → Done, with the stage reached so far.
export function StageTrack({ stage, problem = false }: { stage: number; problem?: boolean }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Pickup progress">
      {CUSTOMER_STAGES.map((label, i) => {
        const done = i <= stage
        const current = i === stage
        return (
          <li key={label} className="min-w-0" aria-current={current ? 'step' : undefined}>
            <span
              className={`block h-1.5 rounded-full transition-colors duration-500 ${
                done ? (problem && current ? 'bg-danger' : 'bg-action-strong') : 'bg-line'
              }`}
            />
            <span className={`mt-2 flex items-center gap-1 text-xs font-medium ${done ? 'text-ink' : 'text-ink-3'}`}>
              {done && <Check aria-hidden className="size-3 shrink-0" strokeWidth={3} />}
              <span className="truncate">{label}</span>
              <span className="sr-only">{done ? '(done)' : '(not yet)'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export const BUTTON_PRIMARY =
  'press inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-action px-6 text-[15px] font-semibold text-on-action shadow-card transition hover:brightness-105 hover:shadow-lift disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3 disabled:shadow-none disabled:ring-0'
export const BUTTON_QUIET =
  'press inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold text-ink ring-1 ring-line-strong transition hover:bg-canvas disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3 disabled:shadow-none disabled:ring-0'
// For refusing or rejecting: outlined in red, never filled (the filled button stays the main action).
export const BUTTON_DANGER =
  'press inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold text-danger ring-1 ring-danger/40 transition hover:bg-danger-wash disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3 disabled:shadow-none disabled:ring-0'
export const FIELD =
  'block w-full rounded-control border border-line-strong bg-surface px-3.5 py-3 text-[15px] text-ink transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-action-deep focus:outline-none focus:ring-4 focus:ring-action/25'

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-action-deep hover:underline">
      {children}
    </Link>
  )
}
