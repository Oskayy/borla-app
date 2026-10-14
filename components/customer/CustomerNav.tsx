'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TabBar from '@/components/kit/TabBar'
import { Bell, CalendarPlus, Home, LayoutList, MapPin, Menu, Settings, User } from 'lucide-react'

const BASE = '/dashboard/customer'

export const CUSTOMER_LINKS = [
  { href: BASE, label: 'My home', icon: Home, exact: true },
  { href: `${BASE}/book`, label: 'Book a pickup', icon: CalendarPlus },
  { href: `${BASE}/orders`, label: 'My orders', icon: LayoutList },
  { href: `${BASE}/notifications`, label: 'Notifications', icon: Bell, badge: true },
  { href: `${BASE}/home-location`, label: 'Home pin', icon: MapPin },
  { href: `${BASE}/profile`, label: 'Profile', icon: User },
  { href: `${BASE}/settings`, label: 'Settings', icon: Settings },
]

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

// Desktop sidebar links.
export function SidebarNav({ unread }: { unread: number }) {
  const pathname = usePathname()
  return (
    <ul className="grid gap-0.5">
      {CUSTOMER_LINKS.map(({ href, label, icon: Icon, exact, badge }) => {
        const on = isActive(pathname, href, exact)
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] font-medium transition ${
                on ? 'bg-customer-wash text-customer-deep' : 'text-ink-2 hover:bg-canvas hover:text-ink'
              }`}
            >
              <Icon aria-hidden className="size-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-customer px-1.5 text-[11px] font-semibold tabular-nums text-white">
                  {unread > 9 ? '9+' : unread}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

const MORE = ['/notifications', '/home-location', '/profile', '/settings'].map((p) => `${BASE}${p}`)

const TABS = [
  { href: BASE, label: 'Home', icon: Home, exact: true },
  { href: `${BASE}/book`, label: 'Book', icon: CalendarPlus },
  { href: `${BASE}/orders`, label: 'Orders', icon: LayoutList },
  { href: `${BASE}/more`, label: 'More', icon: Menu, also: MORE },
]

// Phone bottom tabs: the shared floating pill. "More" is also active on the account pages it lists.
export function BottomTabs() {
  return <TabBar tabs={TABS} label="Customer" />
}
