import { Check } from 'lucide-react'

export interface TrackStep {
  label: string
  sub?: string // e.g. "3 of 4"
  done: boolean
}

// Three steps on a line: check circles (done), a ringed circle (now), grey circles (later), names underneath.
// The first step not done is the current one. Made for three steps (left, middle, right).
export default function StepTrack({ steps, label }: { steps: [TrackStep, TrackStep, TrackStep]; label: string }) {
  const current = steps.findIndex((s) => !s.done)
  // The dark line runs up to the current step (or the end once all are done).
  const fill = Math.min(steps.filter((s) => s.done).length, 2) / 2
  return (
    <div className="relative">
      <span aria-hidden className="absolute left-3 right-3 top-3 h-[3px] -translate-y-1/2 rounded-full bg-line-strong" />
      <span aria-hidden className="absolute left-3 top-3 h-[3px] -translate-y-1/2 rounded-full bg-ink" style={{ width: `calc((100% - 24px) * ${fill})` }} />
      <ol aria-label={label} className="relative grid grid-cols-3">
        {steps.map((s, i) => {
          const now = i === current
          return (
            <li key={s.label} aria-current={now ? 'step' : undefined} className={`min-w-0 ${i === 0 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'}`}>
              <span
                className={`inline-grid size-6 place-items-center rounded-full ${
                  s.done ? 'bg-ink text-canvas' : now ? 'bg-canvas ring-[3px] ring-inset ring-ink' : 'bg-line-strong'
                }`}
              >
                {s.done && <Check aria-hidden className="size-3.5" strokeWidth={3.5} />}
              </span>
              <span className={`mt-1.5 block truncate text-[13px] font-semibold ${s.done || now ? 'text-ink' : 'text-ink-3'}`}>{s.label}</span>
              {s.sub && <span className="block truncate text-xs text-ink-3">{s.sub}</span>}
              <span className="sr-only">{s.done ? '(done)' : now ? '(now)' : '(not yet)'}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
