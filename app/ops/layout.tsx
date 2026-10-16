import { redirect } from 'next/navigation'
import { AccountTheme } from '@/components/ThemeToggle'
import { parseThemePrefs } from '@/lib/theme'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { STAFF_ROLES } from '@/lib/staff'
import { ROLE_NAMES, sectionsFor } from '@/lib/ops-nav'
import { queueCounts } from '@/lib/ops-queue'
import { systemHealth } from '@/lib/system-health'
import { getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, isWithinShift, windowLabel } from '@/lib/shift'
import OpsShell from '@/components/ops/OpsShell'
import EnableAlerts from '@/components/EnableAlerts'

export const dynamic = 'force-dynamic'

// Reads the clock: outside the component so the render stays pure.
async function shiftNow() {
  const settings = await getShiftSettings()
  const now = new Date()
  const drivers = await prisma.driverProfile.findMany({
    where: { isOnline: true, approvalStatus: 'APPROVED' },
    select: { isOnline: true, onlineOverrideUntil: true },
  })
  return {
    hours: windowLabel(settings),
    running: isWithinShift(now, settings),
    online: drivers.filter((d) => isDriverAvailable(d, now, settings)).length,
  }
}

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Only active staff can use ops pages; staff who must still replace their temporary password are sent to do that.
  // (Each page and API route also checks the exact roles it allows.)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true, active: true, mustChangePassword: true, themePrefs: true } })
  if (!me || !me.active) redirect('/login')
  if (!STAFF_ROLES.includes(me.role)) redirect('/dashboard')
  if (me.mustChangePassword) redirect('/reset-password?first=1')

  // The menu shows only the pages this role can open, with how many things wait on each.
  const [counts, health, shift, factors] = await Promise.all([queueCounts(me.role), systemHealth(), shiftNow(), supabase.auth.mfa.listFactors()])
  const sections = sectionsFor(me.role).map((s) => ({
    title: s.title,
    links: s.links.map((l) => ({ href: l.href, label: l.label, icon: l.icon, count: l.queue ? counts[l.queue] : 0 })),
  }))
  const has2fa = !!factors.data?.totp?.some((f) => f.status === 'verified')

  return (
    <>
    <AccountTheme app="ops" saved={parseThemePrefs(me.themePrefs).ops ?? null} />
    <OpsShell sections={sections} name={me.name} role={ROLE_NAMES[me.role] ?? me.role} health={health} has2fa={has2fa} shift={shift}>
      <div className="mx-auto max-w-7xl">
        <EnableAlerts compact message="Turn on alerts on this device so you hear when tonight's plan is ready or an order needs a driver." />
        {children}
      </div>
    </OpsShell>
    </>
  )
}
