'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  Clock,
  Factory,
  Flag,
  KeyRound,
  LayoutDashboard,
  Map,
  Menu,
  Percent,
  Route,
  Star,
  Tags,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import Logo from '@/components/Logo'
import SignOutButton from '@/components/SignOutButton'

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  BadgeCheck,
  Car,
  Clock,
  Factory,
  Flag,
  KeyRound,
  LayoutDashboard,
  Map,
  Percent,
  Route,
  Star,
  Tags,
  Truck,
  Users,
  Wallet,
}

export interface ShellSection {
  title: string
  links: { href: string; label: string; icon: string; count: number }[]
}

function isActive(pathname: string, href: string) {
  return href === '/ops' ? pathname === '/ops' : pathname === href || pathname.startsWith(`${href}/`)
}

function Nav({ sections, onNavigate }: { sections: ShellSection[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Ops" className="grid gap-5">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="px-3 text-xs font-semibold text-night-muted">{s.title}</p>
          <ul className="mt-1.5 grid gap-0.5">
            {s.links.map((l) => {
              const on = isActive(pathname, l.href)
              const Icon = ICONS[l.icon] ?? LayoutDashboard
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onNavigate}
                    aria-current={on ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-[14px] lg:min-h-9 font-medium transition ${
                      on ? 'bg-white/10 text-white' : 'text-night-ink/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon aria-hidden className={`size-4 shrink-0 ${on ? 'text-[#a9a3ff]' : 'text-night-muted'}`} />
                    <span className="flex-1 truncate">{l.label}</span>
                    {l.count > 0 && (
                      <span className="min-w-6 rounded-full bg-ops px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-white">
                        {l.count > 99 ? '99+' : l.count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Who({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-night-line pt-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ops text-sm font-semibold text-white">
        {name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? '')
          .join('')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{name}</span>
        <span className="block truncate text-xs text-night-muted">{role}</span>
      </span>
    </div>
  )
}

// The ops console frame: a night-navy sidebar on desktop; a top bar with a slide-out menu on phones.
export default function OpsShell({
  sections,
  name,
  role,
  children,
}: {
  sections: ShellSection[]
  name: string
  role: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Close the phone menu on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <Link href="/ops" onClick={onNavigate} aria-label="Trashit Ops home" className="flex shrink-0 items-center gap-2 px-6 pb-4 pt-5">
        <Logo onDark height={24} />
        <span className="rounded-md bg-ops px-1.5 py-0.5 text-xs font-semibold text-white">Ops</span>
      </Link>
      {/* Only the links scroll; the logo and the account stay put on short screens. */}
      <div className="ops-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <Nav sections={sections} onNavigate={onNavigate} />
      </div>
      <div className="grid shrink-0 gap-2 px-4 pb-4">
        <Who name={name} role={role} />
        <SignOutButton className="flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-[14px] font-medium text-night-ink/80 hover:bg-white/5 hover:text-white" />
      </div>
    </div>
  )

  return (
    <div data-surface="new" className="theme-ops min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-night lg:block">{sidebar()}</aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-night-line bg-night px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="-ml-2 grid size-11 place-items-center rounded-control text-white hover:bg-white/10"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <Link href="/ops" aria-label="Trashit Ops home" className="flex items-center gap-2">
          <Logo onDark height={22} />
          <span className="rounded-md bg-ops px-1.5 py-0.5 text-xs font-semibold text-white">Ops</span>
        </Link>
      </header>

      {/* Phone menu */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-night/60" />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-night shadow-lift">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 grid size-11 place-items-center rounded-control text-white hover:bg-white/10"
            >
              <X aria-hidden className="size-5" />
            </button>
            {sidebar(() => setOpen(false))}
          </div>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  )
}
