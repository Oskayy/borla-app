'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Moon, User, Wallet } from 'lucide-react'

const BASE = '/dashboard/driver'

// Vehicle, availability, statistics and statements live under Account.
const LINKS: { href: string; label: string; short?: string; icon: typeof Moon; exact?: boolean; also?: string[] }[] = [
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

// Desktop: tabs under the top bar.
export function DriverTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Driver" className="hidden border-b border-line lg:block">
      <ul className="mx-auto flex max-w-5xl gap-1 px-6">
        {LINKS.map(({ href, label, icon: Icon, exact, also }) => {
          const on = isActive(pathname, href, exact) || !!also?.some((p) => pathname.startsWith(p))
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-[15px] font-medium transition ${
                  on ? 'border-action text-ink' : 'border-transparent text-ink-3 hover:text-ink'
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

// Phones: big bottom tabs, easy to hit with a thumb.
export function DriverBottomTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Driver" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {LINKS.map(({ href, label, short, icon: Icon, exact, also }) => {
          const on = isActive(pathname, href, exact) || !!also?.some((p) => pathname.startsWith(p))
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${on ? 'text-action' : 'text-ink-3'}`}
              >
                <Icon aria-hidden className="size-6" strokeWidth={on ? 2.4 : 2} />
                {short ?? label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
