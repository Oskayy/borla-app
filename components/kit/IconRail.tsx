'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isTabActive, type Tab } from '@/components/kit/TabBar'

export interface RailItem extends Tab {
  count?: number // things waiting there
  urgent?: boolean // waiting work is a problem now (red badge)
}

// Desktop: a narrow rail of icons. Each name shows beside its icon on hover or keyboard focus, and is
// always the link's accessible name. Counts show as small badges.
export default function IconRail({ items, label, top, bottom }: { items: RailItem[]; label: string; top?: React.ReactNode; bottom?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full w-[84px] flex-col items-center gap-3 bg-rail py-5">
      {top}
      <nav aria-label={label} className="flex-1">
        <ul className="flex flex-col items-center gap-1.5">
          {items.map((item) => {
            const on = isTabActive(pathname, item)
            const Icon = item.icon
            return (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  aria-label={item.count ? `${item.label} (${item.count} waiting)` : item.label}
                  className={`press relative grid size-12 place-items-center rounded-[16px] transition-colors duration-200 ${
                    on ? 'bg-hero text-on-hero shadow-card' : 'text-ink-2 hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Icon aria-hidden className="size-[21px]" strokeWidth={on ? 2.3 : 2} />
                  {!!item.count && (
                    <span
                      aria-hidden
                      className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums ring-2 ring-rail ${
                        item.urgent ? 'bg-danger text-white' : 'bg-highlight text-on-highlight'
                      }`}
                    >
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </Link>
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-40 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-full bg-hero px-3 py-1.5 text-[13px] font-semibold text-on-hero opacity-0 shadow-lift transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                >
                  {item.label}
                </span>
              </li>
            )
          })}
        </ul>
      </nav>
      {bottom}
    </div>
  )
}
