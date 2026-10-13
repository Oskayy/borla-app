import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, ShieldAlert, Truck } from 'lucide-react'
import { DriverBottomTabs, DriverTabs } from '@/components/driver/DriverNav'
import ThemeToggle from '@/components/ThemeToggle'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { windowLabel } from '@/lib/shift'

// The driver workspace: monochrome cards in light or dark mode (the theme switch), big touch targets,
// a greeting header and a floating tab bar for the thumb.
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true, active: true } }),
    prisma.driverProfile.findUnique({
      where: { userId: user.id },
      select: { vehiclePlate: true, vehicleTypeRef: { select: { name: true } }, vehicleType: true, approvalStatus: true, approvalNote: true, submittedAt: true },
    }),
    getShiftSettings(),
  ])
  if (!me || !me.active) redirect('/login')
  if (me.role !== 'DRIVER') redirect('/dashboard')

  const vehicle = profile?.vehicleTypeRef?.name ?? profile?.vehicleType ?? null
  const firstName = me.name.split(/\s+/)[0] ?? me.name
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div data-surface="new" className="theme-driver min-h-dvh">
      <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard/driver/account"
            aria-label="Your account"
            className="press grid size-12 shrink-0 place-items-center rounded-full bg-action text-[15px] font-semibold text-on-action"
          >
            {initials}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold leading-tight tracking-tight">Hello, {firstName}</p>
            <p className="flex items-center gap-1 truncate text-sm text-ink-3">
              <Truck aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">
                {vehicle ? `${vehicle}${profile?.vehiclePlate ? ` · ${profile.vehiclePlate}` : ''}` : 'No vehicle yet'}
                <span className="hidden sm:inline"> · Shift {windowLabel(settings)}</span>
              </span>
            </p>
          </div>
          <ThemeToggle className="bg-surface ring-0" />
        </div>
        <DriverTabs />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-4 sm:px-6 lg:pb-16">
        {/* Until a driver is approved, every page says where the application stands. */}
        {profile && profile.approvalStatus !== 'APPROVED' && (
          <Link
            href="/dashboard/driver/verification"
            className={`press mb-5 flex items-start gap-3 rounded-[20px] p-4 ${profile.approvalStatus === 'REJECTED' ? 'bg-danger-wash' : 'bg-surface'}`}
          >
            <ShieldAlert aria-hidden className={`mt-0.5 size-5 shrink-0 ${profile.approvalStatus === 'REJECTED' ? 'text-danger' : 'text-ink'}`} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {profile.approvalStatus === 'REJECTED'
                  ? 'Your application needs changes'
                  : profile.submittedAt
                    ? 'Your application is being reviewed'
                    : 'Finish your application'}
              </span>
              <span className="block text-sm text-ink-2">
                {profile.approvalStatus === 'REJECTED'
                  ? profile.approvalNote ?? 'See what to fix, then send it again.'
                  : profile.submittedAt
                    ? "You'll get stops once Trashit approves you. You can set up your account meanwhile."
                    : 'Add your Ghana Card number, plate, vehicle photo and a photo of you, then send them for review.'}
              </span>
            </span>
            <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
          </Link>
        )}
        {children}
      </main>
      <DriverBottomTabs />
    </div>
  )
}
