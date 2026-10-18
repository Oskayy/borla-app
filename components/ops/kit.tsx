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
    <p className="flex items-center gap-2.5 rounded-card bg-surface p-4 text-[15px] text-ink-2 shadow-card ring-1 ring-line/70 sm:px-5">
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

export const PANEL = 'rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6'
export const SELECT =
  'min-h-11 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink focus:border-action focus:outline-none focus:ring-3 focus:ring-action/20'
export const CHECK = 'size-4 accent-[var(--color-action-deep)]'

// A headline number with its label and an optional note under it. `hero` makes it the page's one dark tile.
// `tone` colours the note: good news green, a problem red, otherwise plain.
export function Kpi({
  label,
  value,
  unit,
  note,
  tone = 'plain',
  hero = false,
  children,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  note?: string
  tone?: 'good' | 'bad' | 'plain'
  hero?: boolean
  children?: React.ReactNode
}) {
  const noteCls = hero
    ? tone === 'bad'
      ? 'bg-white/15 text-[#ffc2b8]'
      : 'bg-white/15 text-highlight'
    : tone === 'good'
      ? 'bg-ok-wash text-ok-deep'
      : tone === 'bad'
        ? 'bg-danger-wash text-danger'
        : 'bg-canvas text-ink-2'
  return (
    <div className={`min-w-0 rounded-card p-4 sm:p-5 ${hero ? 'hero-glow bg-hero text-on-hero shadow-lift' : 'bg-surface shadow-card ring-1 ring-line/70'}`}>
      <p className={`text-[13px] ${hero ? 'text-on-hero-2' : 'text-ink-2'}`}>{label}</p>
      <p className="mt-2.5 truncate text-[22px] sm:text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums">
        {value}
        {unit && <span className={`ml-1 text-sm font-medium tracking-normal ${hero ? 'text-on-hero-2' : 'text-ink-3'}`}>{unit}</span>}
      </p>
      {note && <p className={`mt-2.5 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold ${noteCls}`}>{note}</p>}
      {children}
    </div>
  )
}

// A titled card for a chart or list.
export function Card({ title, sub, action, children, className = '', id }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70 ${className}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
