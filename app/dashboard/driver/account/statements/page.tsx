import { FileText } from 'lucide-react'
import { recentPeriods, periodQuery, type Period } from '@/lib/statement'
import { BackToAccount } from '@/components/driver/AccountRow'
import InfoTip from '@/components/InfoTip'

// Reads the clock: outside the component.
function periods() {
  return recentPeriods(new Date())
}

function List({ id, title, items, info }: { id: string; title: string; items: Period[]; info?: string }) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="scroll-mt-24 rounded-card bg-surface p-3 shadow-card ring-1 ring-line/70 sm:p-4">
      <h2 id={`h-${id}`} className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-sm font-semibold text-ink-3">
        {title} {info && <InfoTip text={info} />}
      </h2>
      <ul className="divide-y divide-line">
        {items.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3 px-2 py-2">
            <span className="flex min-w-0 items-center gap-2.5 text-[15px] font-medium">
              <FileText aria-hidden className="size-4 shrink-0 text-ink-3" /> <span className="truncate">{p.label}</span>
            </span>
            <span className="flex shrink-0 gap-2">
              <a
                href={`/api/driver/statement?${periodQuery(p)}&format=pdf`}
                aria-label={`${p.label}, PDF`}
                className="press inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-action-deep ring-1 ring-action/50 hover:bg-action-wash"
              >
                PDF
              </a>
              <a
                href={`/api/driver/statement?${periodQuery(p)}&format=csv`}
                aria-label={`${p.label}, CSV for a spreadsheet`}
                className="press inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink-2 ring-1 ring-line-strong hover:bg-canvas"
              >
                CSV
              </a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function DriverStatementsPage() {
  const { weeks, months, years } = periods()
  return (
    <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <BackToAccount />
        <h1 className="anim-rise text-[clamp(1.75rem,2.8vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.03em]">Earnings statements</h1>
      </div>
      <List id="weekly" title="Weekly" items={weeks} />
      <List id="monthly" title="Monthly" items={months} />
      <List
        id="yearly"
        title="Yearly (tax documents)"
        items={years}
        info="Everything Trashit paid you in the year, for your records or a tax return. It isn't tax advice."
      />
    </div>
  )
}
