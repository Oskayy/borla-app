import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Moon, ShieldAlert, Truck } from 'lucide-react'
import Logo from '@/components/Logo'
import { DriverBottomTabs, DriverTabs } from '@/components/driver/DriverNav'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { windowLabel } from '@/lib/shift'

// The driver workspace: night theme (used outdoors in the dark), amber actions, big touch targets.
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
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div data-surface="new" className="theme-night min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard/driver" aria-label="Trashit driver home" className="flex items-center gap-2">
            <Logo height={26} onDark />
            <span className="hidden text-sm font-semibold text-ink-3 sm:inline">Driver</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {vehicle && (
              <span className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line sm:inline-flex">
                <Truck aria-hidden className="size-4 text-action" /> {vehicle}
                {profile?.vehiclePlate && <span className="text-ink-3">· {profile.vehiclePlate}</span>}
              </span>
            )}
            <span className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line sm:inline-flex">
              <Moon aria-hidden className="size-4 text-ops-deep" /> Shift {windowLabel(settings)}
            </span>
            <Link href="/dashboard/driver/account" aria-label="Your account" className="grid size-11 place-items-center rounded-full bg-action text-sm font-semibold text-on-action">
              {initials}
            </Link>
          </div>
        </div>
        <DriverTabs />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16">
        {/* Until a driver is approved, every page says where the application stands. */}
        {profile && profile.approvalStatus !== 'APPROVED' && (
          <Link
            href="/dashboard/driver/verification"
            className={`press mb-5 flex items-start gap-3 rounded-card p-4 ring-1 ${
              profile.approvalStatus === 'REJECTED' ? 'bg-danger-wash ring-danger/30' : 'bg-surface ring-action/40'
            }`}
          >
            <ShieldAlert aria-hidden className={`mt-0.5 size-5 shrink-0 ${profile.approvalStatus === 'REJECTED' ? 'text-danger' : 'text-action'}`} />
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
