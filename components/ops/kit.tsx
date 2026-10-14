import { CheckCircle2 } from 'lucide-react'
import StatusChip from '@/components/kit/Chip'

// Small pieces the ops pages share, on the design tokens. Tones follow the shared status colours:
// ops = verified / done (green, with a tick), driver = held by a driver, on the way (amber),
// neutral = waiting or in progress, danger = needs a person (red).

export type Tone = 'neutral' | 'ops' | 'driver' | 'danger'

const TONES = { neutral: 'neutral', ops: 'done', driver: 'progress', danger: 'problem' } as const

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <StatusChip tone={TONES[tone]}>{children}</StatusChip>
}

export function SectionTitle({ children, count, hint, id }: { children: React.ReactNode; count?: number; hint?: string; id?: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {children}
        {count != null && <span className="ml-1.5 text-base font-normal tabular-nums text-ink-3">({count})</span>}
      </h2>
      {hint && <p className="mt-0.5 text-sm text-ink-3">{hint}</p>}
    </div>
  )
}

export function AllClear({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 rounded-card bg-surface p-4 text-[15px] text-ink-2 ring-1 ring-line sm:px-5">
      <CheckCircle2 aria-hidden className="size-5 shrink-0 text-ok-deep" /> {children}
    </p>
  )
}

// The result of an action, announced to screen readers; empty until there is one.
export function Result({ msg }: { msg?: { ok: boolean; text: string } | null }) {
  return (
    <p aria-live="polite" className={`mt-2 text-sm empty:hidden ${msg?.ok ? 'text-ok-deep' : 'text-danger'}`}>
      {msg?.text}
    </p>
  )
}

export const PANEL = 'rounded-card bg-surface p-5 ring-1 ring-line sm:p-6'
export const SELECT =
  'min-h-11 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink focus:border-action focus:outline-none focus:ring-3 focus:ring-action/20'
export const CHECK = 'size-4 accent-[var(--color-action-deep)]'
