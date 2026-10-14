import Link from 'next/link'
import { Truck } from 'lucide-react'
import { DriverBottomTabs, DriverTabs } from '@/components/driver/DriverNav'
import ThemeToggle from '@/components/ThemeToggle'

// The driver workspace frame: a quiet top bar (avatar, vehicle and plate, theme), pill tabs on a computer and
// the floating tab bar on a phone. The greeting lives on the page itself, once.
export default function DriverFrame({
  initials,
  vehicle,
  shift,
  notice,
  children,
}: {
  initials: string
  vehicle: string // "Aboboyaa tricycle · GT 4521-23", or "No vehicle yet"
  shift: string // "8:00pm – 6:00am"
  notice?: React.ReactNode // e.g. where the driver's application stands
  children: React.ReactNode
}) {
  return (
    <div data-surface="new" className="theme-driver min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/driver/account"
            aria-label="Your account"
            className="press grid size-11 shrink-0 place-items-center rounded-full bg-selected text-[15px] font-semibold text-on-selected ring-2 ring-surface"
          >
            {initials}
          </Link>
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink-3">
            <Truck aria-hidden className="size-4 shrink-0" />
            <span className="truncate">
              {vehicle}
              <span className="hidden sm:inline"> · Shift {shift}</span>
            </span>
          </p>
          <ThemeToggle className="bg-surface ring-0" />
        </div>
        <DriverTabs />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
        {notice}
        {children}
      </main>
      <DriverBottomTabs />
    </div>
  )
}
