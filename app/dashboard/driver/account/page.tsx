import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BarChart3,
  Bell,
  CalendarDays,
  Calculator,
  FileText,
  History,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Receipt,
  Truck,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { dateLabel } from '@/lib/format'
import { NIGHT_NAMES } from '@/lib/availability'
import { AVATAR_DOC, driverPhotoUrls } from '@/lib/driver-photos'
import { BUTTON_QUIET } from '@/components/ui'
import { AccountGroup, AccountRow } from '@/components/driver/AccountRow'
import PhotoUpload from '@/components/driver/PhotoUpload'
import SignOutButton from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

function nightsSummary(nights: number[]): string {
  if (nights.length === 7) return 'Every night'
  if (nights.length === 0) return 'No nights'
  return [1, 2, 3, 4, 5, 6, 0].filter((n) => nights.includes(n)).map((n) => NIGHT_NAMES[n].slice(0, 3)).join(', ')
}

// The driver's account: profile, settings, job preferences, job analytics and statistics.
export default async function DriverAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile, photos] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true, createdAt: true } }),
    prisma.driverProfile.findUnique({
      where: { userId: user.id },
      select: { workNights: true, vehiclePlate: true, zone: { select: { name: true } }, vehicleTypeRef: { select: { name: true } } },
    }),
    driverPhotoUrls(user.id, [AVATAR_DOC]),
  ])
  if (!me) redirect('/login')
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-bold leading-tight tracking-[-0.025em]">Account</h1>

      <section aria-label="Profile" className="flex items-center gap-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <PhotoUpload type={AVATAR_DOC} url={photos[AVATAR_DOC]} fallback={initials} round label="Change your profile picture" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold tracking-tight">{me.name}</p>
          <p className="truncate text-sm text-ink-3">{me.phone}</p>
          <p className="truncate text-sm text-ink-3">{me.email}</p>
          <p className="text-xs text-ink-3">Driving with Trashit since {dateLabel(me.createdAt)}</p>
        </div>
        <Link href="/dashboard/driver/account/profile" className={BUTTON_QUIET}>
          <Pencil aria-hidden className="size-4" /> Edit
        </Link>
      </section>

      <AccountGroup title="Settings">
        <AccountRow href="/dashboard/driver/account/security" icon={KeyRound} title="Sign-in and security" />
        <AccountRow href="/dashboard/driver/account/privacy" icon={Lock} title="Privacy and data" />
        <AccountRow href="/dashboard/driver/account/communication" icon={Bell} title="Communication" info="Alerts on this phone when stops are added to your route." />
      </AccountGroup>

      <AccountGroup title="Job preferences">
        <AccountRow
          href="/dashboard/driver/profile-setup"
          icon={MapPin}
          title="Working zone and home base"
          value={profile?.zone?.name ?? undefined}
          info="Where you start each night and how far you'll travel. Stops are offered within this distance."
        />
        <AccountRow href="/dashboard/driver/availability" icon={CalendarDays} title="Availability" value={profile ? nightsSummary(profile.workNights) : undefined} />
        <AccountRow
          href="/dashboard/driver/vehicle"
          icon={Truck}
          title="Vehicle"
          value={[profile?.vehicleTypeRef?.name, profile?.vehiclePlate].filter(Boolean).join(' · ') || undefined}
        />
      </AccountGroup>

      <AccountGroup title="Job analytics">
        <AccountRow href="/dashboard/driver/account/statements" icon={Receipt} title="Earnings statements" value="Weekly, monthly" />
        <AccountRow
          href="/dashboard/driver/account/statements#yearly"
          icon={FileText}
          title="Tax documents"
          info="A yearly summary of what Trashit paid you, for your records. It isn't tax advice."
        />
        <AccountRow href="/dashboard/driver/account/pay" icon={Calculator} title="How your pay is worked out" />
        <AccountRow href="/dashboard/driver/account/trips" icon={History} title="Trip history" />
      </AccountGroup>

      <AccountGroup title="Statistics">
        <AccountRow href="/dashboard/driver/performance" icon={BarChart3} title="Ratings, acceptance and missed stops" />
      </AccountGroup>

      <div className="rounded-card bg-surface p-3 ring-1 ring-line sm:p-4">
        <SignOutButton className="press flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-[15px] font-medium text-danger hover:bg-danger-wash" />
      </div>
    </div>
  )
}
