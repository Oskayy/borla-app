import { Check } from 'lucide-react'

export interface TrackStep {
  label: string
  sub?: string // e.g. "3 of 4"
  done: boolean
}

// Steps on a line: tick circles (done), a ringed circle (now), plain circles (later), names underneath.
// The first step not done is the current one. Works for three or four steps; `onHero` for the dark hero card.
export default function StepTrack({ steps, label, onHero = false }: { steps: TrackStep[]; label: string; onHero?: boolean }) {
  const current = steps.findIndex((s) => !s.done)
  const last = steps.length - 1
  // The filled line runs up to the current step (or the end once all are done).
  const fill = Math.min(steps.filter((s) => s.done).length, last) / last
  const c = onHero
    ? { track: 'bg-white/20', fill: 'bg-highlight', done: 'bg-highlight text-on-highlight', now: 'bg-hero ring-[3px] ring-inset ring-highlight', later: 'bg-white/20', text: 'text-on-hero', muted: 'text-on-hero-2' }
    : { track: 'bg-line-strong', fill: 'bg-action-strong', done: 'bg-action-strong text-white', now: 'bg-canvas ring-[3px] ring-inset ring-action-strong', later: 'bg-line-strong', text: 'text-ink', muted: 'text-ink-3' }
  return (
    <div className="relative">
      <span aria-hidden className={`absolute left-3 right-3 top-3 h-[3px] -translate-y-1/2 rounded-full ${c.track}`} />
      <span
        aria-hidden
        className={`absolute left-3 top-3 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-500 ease-[var(--ease-out)] ${c.fill}`}
        style={{ width: `calc((100% - 24px) * ${fill})` }}
      />
      <ol aria-label={label} className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const now = i === current
          const align = i === 0 ? 'text-left' : i === last ? 'text-right' : 'text-center'
          return (
            <li key={s.label} aria-current={now ? 'step' : undefined} className={`min-w-0 ${align}`}>
              <span className={`inline-grid size-6 place-items-center rounded-full ${s.done ? c.done : now ? c.now : c.later}`}>
                {s.done && <Check aria-hidden className="size-3.5" strokeWidth={3.5} />}
              </span>
              <span className={`mt-1.5 block truncate text-[13px] font-semibold ${s.done || now ? c.text : c.muted}`}>{s.label}</span>
              {s.sub && <span className={`block truncate text-xs ${c.muted}`}>{s.sub}</span>}
              <span className="sr-only">{s.done ? '(done)' : now ? '(now)' : '(not yet)'}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
