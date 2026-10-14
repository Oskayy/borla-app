'use client'

import Link from 'next/link'
import TabBar from '@/components/kit/TabBar'
import { Bell, CalendarPlus, Headphones, Home, LayoutList, MapPin, Menu, Settings, User } from 'lucide-react'
import Logo from '@/components/Logo'
import IconRail, { type RailItem } from '@/components/kit/IconRail'

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

// Desktop: the shared icon rail (names show on hover and focus), with the logo on top and help and the profile below.
export function CustomerRail({ unread, initials, help }: { unread: number; initials: string; help: string | null }) {
  const items: RailItem[] = CUSTOMER_LINKS.map(({ badge, ...l }) => ({ ...l, count: badge ? unread : 0, countText: 'unread' }))
  return (
    <IconRail
      label="Customer"
      items={items}
      top={
        <Link href={BASE} aria-label="Trashit home" className="mb-3 grid size-12 place-items-center">
          <Logo variant="mark" height={34} />
        </Link>
      }
      bottom={
        <div className="flex flex-col items-center gap-2">
          {help && (
            <a href={help} aria-label="Need help? Talk to the Trashit team" className="press grid size-12 place-items-center rounded-[16px] text-ink-2 hover:bg-surface hover:text-ink">
              <Headphones aria-hidden className="size-[21px]" />
            </a>
          )}
          <Link href={`${BASE}/profile`} aria-label="Your profile" className="press grid size-11 place-items-center rounded-full bg-selected text-sm font-semibold text-on-selected">
            {initials}
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
