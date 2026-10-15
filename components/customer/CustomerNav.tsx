'use client'

import Link from 'next/link'
import TabBar from '@/components/kit/TabBar'
import { Bell, CalendarPlus, Headphones, Home, LayoutList, MapPin, Menu, Settings, User } from 'lucide-react'
import Logo from '@/components/Logo'
import IconRail, { RAIL_LABEL, type RailItem } from '@/components/kit/IconRail'

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

// Desktop: the shared icon rail (it widens on hover to show the names), with the logo on top and help and the
// profile below.
export function CustomerRail({ unread, initials, name, help }: { unread: number; initials: string; name: string; help: string | null }) {
  const items: RailItem[] = CUSTOMER_LINKS.map(({ badge, ...l }) => ({ ...l, count: badge ? unread : 0, countText: 'unread' }))
  return (
    <IconRail
      label="Customer"
      items={items}
      top={
        <Link href={BASE} aria-label="Trashit home" className="mb-3 flex h-12 items-center gap-3 px-1">
          <span className="grid size-10 shrink-0 place-items-center">
            <Logo variant="mark" height={34} />
          </span>
          <span aria-hidden className={`${RAIL_LABEL} text-lg font-extrabold tracking-tight`}>
            Trashit
          </span>
        </Link>
      }
      bottom={
        <div className="flex flex-col gap-1.5">
          {help && (
            <a href={help} aria-label="Need help? Talk to the Trashit team" className="press flex h-12 items-center gap-3 rounded-[16px] px-3 text-ink-2 hover:bg-surface hover:text-ink">
              <Headphones aria-hidden className="size-[22px] shrink-0" />
              <span aria-hidden className={RAIL_LABEL}>
                Need help?
              </span>
            </a>
          )}
          <Link href={`${BASE}/profile`} aria-label="Your profile" className="press flex h-12 items-center gap-3 rounded-[16px] px-0.5 hover:bg-surface">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-selected text-sm font-semibold text-on-selected">{initials}</span>
            <span aria-hidden className={RAIL_LABEL}>
              {name}
            </span>
          </Link>
        </div>
      }
    />
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
