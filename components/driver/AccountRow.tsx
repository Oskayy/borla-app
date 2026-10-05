import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import InfoTip from '@/components/InfoTip'

// One row in an Account list: icon, title, an optional value on the right, and an "i" only where a hint is needed.
export function AccountRow({ href, icon: Icon, title, value, info }: { href: string; icon: LucideIcon; title: string; value?: string; info?: string }) {
  return (
    <li>
      <Link href={href} className="press flex min-h-14 items-center gap-3 rounded-control px-2 hover:bg-canvas">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2 ring-1 ring-line">
          <Icon aria-hidden className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-[15px] font-medium">{title}</span>
          {info && <InfoTip text={info} label={`About ${title}`} />}
        </span>
        {value && <span className="max-w-[45%] shrink-0 truncate text-sm text-ink-3">{value}</span>}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
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
