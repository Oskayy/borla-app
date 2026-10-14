'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Moon, User, Wallet } from 'lucide-react'
import TabBar from '@/components/kit/TabBar'

const BASE = '/dashboard/driver'

// Vehicle, availability, statistics and statements live under Account.
const LINKS: { href: string; label: string; icon: typeof Moon; exact?: boolean; also?: string[] }[] = [
  { href: BASE, label: 'Tonight', icon: Moon, exact: true },
  { href: `${BASE}/earnings`, label: 'Earnings', icon: Wallet },
  {
    href: `${BASE}/account`,
    label: 'Account',
    icon: User,
    also: [`${BASE}/performance`, `${BASE}/profile-setup`, `${BASE}/availability`, `${BASE}/vehicle`],
  },
]

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href)
}

// Desktop: pill tabs under the header.
export function DriverTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Driver" className="hidden lg:block">
      <ul className="mx-auto flex max-w-5xl gap-2 px-6 pb-3">
        {LINKS.map(({ href, label, icon: Icon, exact, also }) => {
          const on = isActive(pathname, href, exact) || !!also?.some((p) => pathname.startsWith(p))
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`press flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition ${
                  on ? 'bg-action text-on-action' : 'text-ink-2 hover:bg-surface hover:text-ink'
                }`}
              >
                <Icon aria-hidden className="size-4" /> {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Phones: the shared floating pill tab bar.
export function DriverBottomTabs() {
  return <TabBar tabs={LINKS} label="Driver" />
}
