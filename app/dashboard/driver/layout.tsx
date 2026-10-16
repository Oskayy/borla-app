import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, ShieldAlert } from 'lucide-react'
import DriverFrame from '@/components/driver/DriverFrame'
import OutboxBar from '@/components/driver/OutboxBar'
import { AccountTheme } from '@/components/ThemeToggle'
import { parseThemePrefs } from '@/lib/theme'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { windowLabel } from '@/lib/shift'

// The driver workspace (evergreen and clay, light or dark): the frame is components/driver/DriverFrame.tsx.
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true, active: true, themePrefs: true } }),
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
    <DriverFrame
      initials={initials}
      vehicle={vehicle ? `${vehicle}${profile?.vehiclePlate ? ` · ${profile.vehiclePlate}` : ''}` : 'No vehicle yet'}
      shift={windowLabel(settings)}
      notice={
        <>
          <AccountTheme app="driver" saved={parseThemePrefs(me.themePrefs).driver ?? null} />
          {/* Pickups and unloads kept on the phone while there was no signal. */}
          <OutboxBar />
          {/* Until a driver is approved, every page says where the application stands. */}
          {profile && profile.approvalStatus !== 'APPROVED' && (
            <Link
              href="/dashboard/driver/verification"
              className={`press lift mb-5 flex items-start gap-3 rounded-card p-4 ring-1 ring-line ${profile.approvalStatus === 'REJECTED' ? 'bg-danger-wash' : 'bg-surface'}`}
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
                      : 'Add your Ghana Card number, plate, vehicle photo, a photo of you and your driver’s licence, then send them for review.'}
                </span>
              </span>
              <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
            </Link>
          )}
        </>
      }
    >
      {children}
    </DriverFrame>
  )
}
