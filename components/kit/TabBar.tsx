'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

export interface Tab {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  also?: string[] // other paths that count as this tab
}

export function isTabActive(pathname: string, tab: Tab) {
  const own = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
  return own || !!tab.also?.some((p) => pathname.startsWith(p))
}

// Phones: a floating pill above the bottom edge. The current tab is a dark pill that shows its name;
// the others are icons (named for screen readers), each still a 48 px target.
export default function TabBar({ tabs, label, className = 'lg:hidden' }: { tabs: Tab[]; label: string; className?: string }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label={label}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] ${className}`}
    >
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-lift ring-1 ring-line">
        {tabs.map((tab) => {
          const on = isTabActive(pathname, tab)
          const Icon = tab.icon
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={on ? 'page' : undefined}
                aria-label={on ? undefined : tab.label}
                className={`press flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-[background-color,color,padding,width] duration-300 ease-[var(--ease-out)] ${
                  on ? 'bg-hero px-5 text-on-hero' : 'w-14 text-ink-3 hover:text-ink'
                }`}
              >
                <Icon aria-hidden className="size-[22px] shrink-0" strokeWidth={on ? 2.3 : 2} />
                {on && <span className="anim-fade">{tab.label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
