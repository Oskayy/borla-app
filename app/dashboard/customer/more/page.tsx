import Link from 'next/link'
import { Bell, ChevronRight, Headphones, MapPin, Settings, User } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { supportHref } from '@/lib/support'
import { ThemeSwitch } from '@/components/ThemeToggle'

// Phones: the account pages that don't fit in the bottom tabs.
const LINKS = [
  { href: '/dashboard/customer/notifications', label: 'Notifications', text: 'Updates about your pickups', icon: Bell },
  { href: '/dashboard/customer/home-location', label: 'Home pin', text: 'Where your driver collects', icon: MapPin },
  { href: '/dashboard/customer/profile', label: 'Profile', text: 'Your name and phone number', icon: User },
  { href: '/dashboard/customer/settings', label: 'Settings', text: 'Security, alerts and sign out', icon: Settings },
]

export default function MorePage() {
  const help = supportHref()
  return (
    <div className="max-w-4xl">
      <PageHeader title="Your account" />
      <ul className="anim-rise overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/70 divide-y divide-line">
        <li>
          <ThemeSwitch />
        </li>
        {LINKS.map(({ href, label, text, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3.5 px-4 hover:bg-canvas">
              <Icon aria-hidden className="size-5 shrink-0 text-action-deep" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-ink-3">{text}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
        {help && (
          <li>
            <a href={help} className="flex min-h-16 items-center gap-3.5 px-4 hover:bg-canvas">
              <Headphones aria-hidden className="size-5 shrink-0 text-action-deep" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Help and support</span>
                <span className="block text-sm text-ink-3">Talk to the Trashit team</span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-ink-3" />
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}
