import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import InfoTip from '@/components/InfoTip'

// One row in an Account list: icon, title, an optional value on the right, and an "i" only where a hint is needed.
// The "i" sits beside the link, not inside it (a button inside a link is invalid and confuses screen readers);
// the whole row still looks and taps like one item.
// `desc`: a short visible line under the title, for settings where people need to know what it does before tapping.
export function AccountRow({
  href,
  icon: Icon,
  title,
  value,
  info,
  desc,
}: {
  href: string
  icon: LucideIcon
  title: string
  value?: string
  info?: string
  desc?: string
}) {
  return (
    <li className="flex min-h-14 items-center gap-1.5 rounded-control px-2 hover:bg-canvas">
      <Link href={href} className="press flex min-h-14 min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2 ring-1 ring-line">
          <Icon aria-hidden className="size-[18px]" />
        </span>
        <span className="min-w-0 py-2">
          <span className="block truncate text-[15px] font-medium">{title}</span>
          {desc && <span className="block text-sm text-ink-3">{desc}</span>}
        </span>
      </Link>
      {info && <InfoTip text={info} label={`About ${title}`} />}
      <Link href={href} tabIndex={-1} aria-hidden className="flex min-h-14 min-w-0 flex-1 items-center justify-end gap-2">
        {value && <span className="truncate text-sm text-ink-3">{value}</span>}
        <ChevronRight className="size-4 shrink-0 text-ink-3" />
      </Link>
    </li>
  )
}

export function AccountGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card bg-surface p-3 ring-1 ring-line sm:p-4">
      <h2 className="px-2 pb-1 pt-1 text-sm font-semibold text-ink-3">{title}</h2>
      <ul className="grid">{children}</ul>
    </section>
  )
}

// Back link for Account sub-pages.
export function BackToAccount() {
  return (
    <Link href="/dashboard/driver/account" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
      <ChevronRight aria-hidden className="size-4 rotate-180" /> Account
    </Link>
  )
}
