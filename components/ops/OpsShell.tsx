'use client'

import { useEffect, useRef, useState } from 'react'
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
  Archive,
  KeyRound,
  Landmark,
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
import { RAIL_LABEL } from '@/components/kit/IconRail'

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  BadgeCheck,
  Car,
  Clock,
  Factory,
  Flag,
  Archive,
  KeyRound,
  Landmark,
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

// Health: green = checked and fine, red = needs a person, grey = switched off.
const DOT: Record<ShellHealth['state'], string> = { ok: 'bg-ok-strong', warn: 'bg-danger', off: 'bg-ink-3' }

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
          <p className="px-3 text-xs font-semibold text-ink-3">{s.title}</p>
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
                      on ? 'bg-selected text-on-selected shadow-card' : 'text-ink-2 hover:bg-surface hover:text-ink'
                    }`}
                  >
                    <Icon aria-hidden className={`size-4 shrink-0 ${on ? 'text-on-selected' : 'text-ink-3'}`} />
                    <span className="flex-1 truncate">{l.label}</span>
                    {l.count > 0 && (
                      <span
                        className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums ${
                          on ? 'bg-white text-ink' : URGENT.has(l.href) ? 'bg-danger text-white' : 'bg-surface text-ink-2 ring-1 ring-line'
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

// Desktop: a narrow rail of icons in sections that widens over the page while the mouse is on it (or the keyboard is
// in it), showing section titles and each page's name, and folds back to icons when the mouse leaves. Counts show as
// badges, red where waiting work is urgent.
function Rail({ sections }: { sections: ShellSection[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Ops" className="ops-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[18px] pb-4">
      {sections.map((s, si) => (
        <div key={s.title} className={si > 0 ? 'mt-3 border-t border-line pt-3' : ''}>
          <p aria-hidden className={`${RAIL_LABEL} h-0 px-3 text-xs text-ink-3 group-hover/rail:mb-1 group-hover/rail:h-auto group-has-[:focus-visible]/rail:mb-1 group-has-[:focus-visible]/rail:h-auto`}>
            {s.title}
          </p>
          <ul aria-label={s.title} className="grid gap-1.5">
            {s.links.map((l) => {
              const on = isActive(pathname, l.href)
              const Icon = ICONS[l.icon] ?? LayoutDashboard
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={on ? 'page' : undefined}
                    aria-label={l.count > 0 ? `${l.label} (${l.count} waiting)` : l.label}
                    className={`press relative flex h-12 w-full items-center gap-3 rounded-[16px] px-3 transition-colors duration-200 ${
                      on ? 'bg-selected text-on-selected shadow-card' : 'text-ink-2 hover:bg-surface hover:text-ink'
                    }`}
                  >
                    <Icon aria-hidden className="size-[22px] shrink-0" strokeWidth={on ? 2.3 : 2} />
                    <span aria-hidden className={RAIL_LABEL}>
                      {l.label}
                    </span>
                    {l.count > 0 && (
                      <span
                        aria-hidden
                        className={`absolute left-[30px] top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums ring-2 ring-rail group-hover/rail:left-auto group-hover/rail:right-3 group-hover/rail:top-3.5 ${
                          URGENT.has(l.href) ? 'bg-danger text-white' : 'bg-highlight text-on-highlight'
                        }`}
                      >
                        {l.count > 99 ? '99+' : l.count}
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

// The night shift in the top bar: hours, whether it's running, drivers online.
function ShiftPill({ shift }: { shift: ShellShift }) {
  return (
    <span className="hidden items-center gap-2 whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-sm ring-1 ring-line md:inline-flex">
      <Moon aria-hidden className="size-4 text-action-deep" />
      <span className="font-semibold tabular-nums">{shift.hours}</span>
      {shift.running ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-action-wash px-2 py-0.5 text-xs font-bold text-action-deep">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-action-deep" /> Live
        </span>
      ) : (
        <span className="text-xs text-ink-3">not running</span>
      )}
      <span className="text-ink-3">
        · {shift.online} {shift.online === 1 ? 'driver' : 'drivers'} online
      </span>
    </span>
  )
}

function ShiftCard({ shift }: { shift: ShellShift }) {
  return (
    <div className="rounded-card bg-surface p-3.5 shadow-card ring-1 ring-line/70">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
          <Moon aria-hidden className="size-3.5" /> Night shift
        </p>
        {shift.running ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-action-wash px-2 py-0.5 text-[11px] font-bold text-action-deep">
            <span className="size-1.5 animate-pulse rounded-full bg-action-deep" aria-hidden /> Live
          </span>
        ) : (
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-3">Not running</span>
        )}
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums tracking-tight">{shift.hours}</p>
      <p className="text-xs text-ink-3">
        {shift.online} {shift.online === 1 ? 'driver' : 'drivers'} online
      </p>
    </div>
  )
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-canvas">
        <span className="grid size-9 place-items-center rounded-full bg-selected text-sm font-semibold text-on-selected">{initials(name)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block whitespace-nowrap text-sm font-semibold">{name}</span>
          <span className="block whitespace-nowrap text-xs text-ink-3">{role}</span>
        </span>
        <ChevronDown aria-hidden className="hidden size-4 text-ink-3 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-card bg-surface p-1.5 shadow-lift shadow-card ring-1 ring-line/70">
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

function HealthMenu({ health, bad }: { health: ShellHealth[]; bad: number }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`press flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium ring-1 transition hover:bg-canvas ${
          bad ? 'text-danger ring-danger/40' : 'text-ink-2 ring-line'
        }`}
      >
        <span className={`size-2 rounded-full ${bad ? 'bg-danger' : 'bg-ok-strong'}`} aria-hidden />
        {bad ? `${bad} system ${bad === 1 ? 'warning' : 'warnings'}` : 'All systems working'}
        <ChevronDown aria-hidden className="size-4" />
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-40 mt-2 w-72 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-lift shadow-card ring-1 ring-line/70">
          {health.map((h) => (
            <li key={h.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className={`size-2 rounded-full ${DOT[h.state]}`} aria-hidden /> {h.label}
              </span>
              <span className={h.state === 'warn' ? 'font-medium text-danger' : 'text-ink-3'}>{h.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// The ops console frame: an icon rail (moss and sky), a top bar with system health, the night shift, alerts,
// 2FA status and the user. Phones get a drawer with the names.
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
        <span className="only-light">
          <Logo height={24} />
        </span>
        <span className="only-dark">
          <Logo onDark height={24} />
        </span>
        <span className="border-l border-line pl-2.5 text-xs font-semibold leading-tight text-ink-3">
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
      <aside className="group/rail fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-stretch gap-3 overflow-hidden border-r border-line bg-rail pt-5 transition-[width,box-shadow] duration-300 ease-[var(--ease-out)] hover:w-[260px] hover:shadow-lift has-[:focus-visible]:w-[260px] has-[:focus-visible]:shadow-lift lg:flex">
        <Link href="/ops" aria-label="Trashit operations home" className="mb-2 flex h-12 items-center gap-3 px-[22px]">
          <span className="grid size-10 shrink-0 place-items-center">
            <Logo variant="mark" height={34} />
          </span>
          <span aria-hidden className={`${RAIL_LABEL} text-lg font-extrabold tracking-tight`}>
            Trashit ops
          </span>
        </Link>
        <Rail sections={sections} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="anim-rise absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-rail shadow-lift">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 grid size-11 place-items-center rounded-full text-ink-2 hover:bg-surface"
            >
              <X aria-hidden className="size-5" />
            </button>
            {sidebar(() => setOpen(false))}
          </div>
        </div>
      )}

      <div className="lg:pl-[84px]">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
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

            {/* System health: real signals only (lib/system-health.ts). The full strip only where it fits;
                otherwise a compact button that opens the list. */}
            <div className="hidden min-w-0 items-center gap-5 overflow-hidden 2xl:flex">
              <span className="text-xs font-semibold text-ink-3">System</span>
              {health.map((h) => (
                <span key={h.label} className="flex items-center gap-1.5 whitespace-nowrap text-sm" title={`${h.label}: ${h.text}`}>
                  <span className={`size-2 rounded-full ${DOT[h.state]}`} aria-hidden />
                  <span className="font-medium">{h.label}</span>
                  <span className={h.state === 'warn' ? 'font-medium text-danger' : 'text-ink-3'}>{h.text}</span>
                </span>
              ))}
            </div>
            <div className="hidden sm:block 2xl:hidden">
              <HealthMenu health={health} bad={healthBad} />
            </div>
            <ShiftPill shift={shift} />

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <OpsAlerts />
              <Link
                href="/account/security"
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold md:inline-flex ${
                  has2fa ? 'bg-ok-wash text-ok-deep' : 'bg-danger-wash text-danger'
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
