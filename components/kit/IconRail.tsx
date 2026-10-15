'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isTabActive, type Tab } from '@/components/kit/TabBar'

export interface RailItem extends Tab {
  count?: number // things waiting there
  urgent?: boolean // waiting work is a problem now (red badge)
  countText?: string // what the count means, for screen readers (default "waiting")
}

// The label beside an icon: hidden while the rail is folded, shown while it is open (mouse on it, or keyboard in it).
export const RAIL_LABEL =
  'truncate whitespace-nowrap text-[15px] font-semibold opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100'

// Desktop: a narrow rail of icons that widens over the page when the mouse is on it (or when someone tabs into it
// with the keyboard), showing each name beside its icon, and folds back to icons when the mouse leaves. A click
// doesn't keep it open. Counts show as small badges.
export default function IconRail({ items, label, top, bottom }: { items: RailItem[]; label: string; top?: React.ReactNode; bottom?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="group/rail absolute inset-y-0 left-0 z-40 flex w-[84px] flex-col gap-3 overflow-hidden border-r border-line bg-rail px-[18px] py-5 transition-[width,box-shadow] duration-300 ease-[var(--ease-out)] hover:w-[244px] hover:shadow-lift has-[:focus-visible]:w-[244px] has-[:focus-visible]:shadow-lift">
      {top}
      <nav aria-label={label} className="flex-1">
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            const on = isTabActive(pathname, item)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  aria-label={item.count ? `${item.label} (${item.count} ${item.countText ?? 'waiting'})` : item.label}
                  className={`press relative flex h-12 w-full items-center gap-3 rounded-[16px] px-3 transition-colors duration-200 ${
                    on ? 'bg-selected text-on-selected shadow-card' : 'text-ink-2 hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Icon aria-hidden className="size-[22px] shrink-0" strokeWidth={on ? 2.3 : 2} />
                  <span aria-hidden className={RAIL_LABEL}>
                    {item.label}
                  </span>
                  {!!item.count && (
                    <span
                      aria-hidden
                      className={`absolute left-[30px] top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums ring-2 ring-rail group-hover/rail:left-auto group-hover/rail:right-3 group-hover/rail:top-3.5 ${
                        item.urgent ? 'bg-danger text-white' : 'bg-highlight text-on-highlight'
                      }`}
                    >
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {bottom}
    </div>
  )
}
