import Link from 'next/link'
import { Check } from 'lucide-react'
import { CUSTOMER_STAGES, TONE_PILL, type CustomerStatus } from '@/lib/order-status'

// Small building blocks shared by the app screens. They use the action colour, which each workspace sets
// (customer green, driver amber on the night theme, ops indigo).

export function PageHeader({ title, lead, action }: { title: string; lead?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
        {lead && <p className="mt-1.5 max-w-[60ch] text-[15px] text-ink-2">{lead}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card bg-surface p-5 ring-1 ring-line sm:p-6 ${className}`}>{children}</section>
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
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONE_PILL[status.tone]}`}>
      {status.tone === 'done' && <Check aria-hidden className="size-3" strokeWidth={3} />}
      {status.label}
    </span>
  )
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
              className={`block h-1.5 rounded-full ${
                done ? (problem && current ? 'bg-danger' : i === 3 ? 'bg-customer' : i === 0 ? 'bg-customer' : 'bg-driver') : 'bg-line'
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
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-action px-5 text-[15px] font-semibold text-on-action shadow-card transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60'
export const BUTTON_QUIET =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-surface px-4 text-[15px] font-semibold text-ink ring-1 ring-line-strong transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60'
// For refusing or rejecting: outlined in red, never filled (the filled button stays the main action).
export const BUTTON_DANGER =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-surface px-4 text-[15px] font-semibold text-danger ring-1 ring-danger/40 transition hover:bg-danger-wash disabled:cursor-not-allowed disabled:opacity-60'
export const FIELD =
  'block w-full rounded-control border border-line-strong bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-action focus:outline-none focus:ring-3 focus:ring-action/20'

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-action-deep hover:underline">
      {children}
    </Link>
  )
}
