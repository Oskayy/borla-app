'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  ChevronDown,
  Clock,
  Factory,
  Flag,
  KeyRound,
  LayoutDashboard,
  Map,
  Menu,
  Moon,
  Percent,
  Route,
  ShieldCheck,
  ShieldAlert,
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
import OpsAlerts from '@/components/OpsAlerts'
import ThemeToggle from '@/components/ThemeToggle'

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

// Queues where waiting work is a problem now (red), rather than routine.
const URGENT = new Set(['/ops/exceptions', '/ops/assign', '/ops/disposal-review'])

export interface ShellSection {
  title: string
  links: { href: string; label: string; icon: string; count: number }[]
}
export interface ShellHealth {
  label: string
  state: 'ok' | 'warn' | 'off'
  text: string
}
export interface ShellShift {
  hours: string
  running: boolean
  online: number
}

const DOT: Record<ShellHealth['state'], string> = { ok: 'bg-[#22a06b]', warn: 'bg-driver', off: 'bg-ink-3' }

function isActive(pathname: string, href: string) {
  return href === '/ops' ? pathname === '/ops' : pathname === href || pathname.startsWith(`${href}/`)
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function Nav({ sections, onNavigate }: { sections: ShellSection[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Ops" className="grid gap-5">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-night-muted">{s.title}</p>
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
                    className={`press flex min-h-11 items-center gap-3 rounded-control px-3 text-[14px] font-medium transition lg:min-h-10 ${
                      on ? 'bg-ops text-white shadow-[0_6px_16px_-8px_rgb(75_64_224/0.8)]' : 'text-night-ink/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon aria-hidden className={`size-4 shrink-0 ${on ? 'text-white' : 'text-night-muted'}`} />
                    <span className="flex-1 truncate">{l.label}</span>
                    {l.count > 0 && (
                      <span
                        className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums ${
                          on ? 'bg-white text-ops-deep' : URGENT.has(l.href) ? 'bg-danger text-white' : 'bg-white/15 text-white'
                        }`}
                      >
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

function ShiftCard({ shift }: { shift: ShellShift }) {
  return (
    <div className="rounded-card bg-white/5 p-3.5 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-night-muted">
          <Moon aria-hidden className="size-3.5" /> Night shift
        </p>
        {shift.running ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22a06b]/20 px-2 py-0.5 text-[11px] font-bold text-[#5fd39a]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#5fd39a]" aria-hidden /> Live
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-night-muted">Not running</span>
        )}
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums tracking-tight text-white">{shift.hours}</p>
      <p className="text-xs text-night-muted">
        {shift.online} {shift.online === 1 ? 'driver' : 'drivers'} online
      </p>
    </div>
  )
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-canvas">
        <span className="grid size-9 place-items-center rounded-full bg-ops text-sm font-semibold text-white">{initials(name)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold">{name}</span>
          <span className="block text-xs text-ink-3">{role}</span>
        </span>
        <ChevronDown aria-hidden className="hidden size-4 text-ink-3 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-card bg-surface p-1.5 shadow-lift ring-1 ring-line">
          <Link href="/account/security" className="flex min-h-10 items-center gap-2.5 rounded-control px-3 text-sm font-medium hover:bg-canvas" onClick={() => setOpen(false)}>
            <ShieldCheck aria-hidden className="size-4 text-ink-3" /> Two-factor sign-in
          </Link>
          <Link href="/reset-password" className="flex min-h-10 items-center gap-2.5 rounded-control px-3 text-sm font-medium hover:bg-canvas" onClick={() => setOpen(false)}>
            <KeyRound aria-hidden className="size-4 text-ink-3" /> Change password
          </Link>
          <SignOutButton className="flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 text-sm font-medium text-danger hover:bg-danger-wash" />
        </div>
      )}
    </div>
  )
}

// The ops console frame: night-navy sidebar, a top bar with system health, alerts, 2FA status and the user.
export default function OpsShell({
  sections,
  name,
  role,
  health,
  has2fa,
  shift,
  children,
}: {
  sections: ShellSection[]
  name: string
  role: string
  health: ShellHealth[]
  has2fa: boolean
  shift: ShellShift
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <Link href="/ops" onClick={onNavigate} aria-label="Trashit operations home" className="flex shrink-0 items-center gap-2.5 px-6 pb-5 pt-5">
        <Logo onDark height={24} />
        <span className="border-l border-white/15 pl-2.5 text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-night-muted">
          Operations
          <br />
          console
        </span>
      </Link>
      <div className="ops-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <Nav sections={sections} onNavigate={onNavigate} />
      </div>
      <div className="shrink-0 px-3 pb-4">
        <ShiftCard shift={shift} />
      </div>
    </div>
  )

  const healthBad = health.filter((h) => h.state !== 'ok').length

  return (
    <div data-surface="new" className="theme-ops min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-night lg:block">{sidebar()}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-night/60" />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-night shadow-lift">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 grid size-11 place-items-center rounded-control text-white hover:bg-white/10"
            >
              <X aria-hidden className="size-5" />
            </button>
            {sidebar(() => setOpen(false))}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="-ml-2 grid size-11 place-items-center rounded-control hover:bg-canvas lg:hidden">
              <Menu aria-hidden className="size-5" />
            </button>
            <Link href="/ops" aria-label="Trashit operations home" className="lg:hidden">
              <span className="only-light">
                <Logo height={22} />
              </span>
              <span className="only-dark">
                <Logo height={22} onDark />
              </span>
            </Link>

            {/* System health: real signals only (lib/system-health.ts). */}
            <div className="hidden min-w-0 items-center gap-5 xl:flex">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">System</span>
              {health.map((h) => (
                <span key={h.label} className="flex items-center gap-1.5 whitespace-nowrap text-sm" title={`${h.label}: ${h.text}`}>
                  <span className={`size-2 rounded-full ${DOT[h.state]}`} aria-hidden />
                  <span className="font-medium">{h.label}</span>
                  <span className={h.state === 'warn' ? 'font-medium text-driver-deep' : 'text-ink-3'}>{h.text}</span>
                </span>
              ))}
            </div>
            {healthBad > 0 && (
              <span className="hidden items-center gap-1.5 text-sm font-medium text-driver-deep sm:flex xl:hidden" title={health.map((h) => `${h.label}: ${h.text}`).join(' · ')}>
                <span className="size-2 rounded-full bg-driver" aria-hidden /> {healthBad} system {healthBad === 1 ? 'warning' : 'warnings'}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <OpsAlerts />
              <Link
                href="/account/security"
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold md:inline-flex ${
                  has2fa ? 'bg-ops-wash text-ops-deep' : 'bg-danger-wash text-danger'
                }`}
              >
                {has2fa ? <ShieldCheck aria-hidden className="size-3.5" /> : <ShieldAlert aria-hidden className="size-3.5" />}
                {has2fa ? '2FA on' : '2FA off'}
              </Link>
              <UserMenu name={name} role={role} />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
