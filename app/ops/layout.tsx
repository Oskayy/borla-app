import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { STAFF_ROLES } from '@/lib/staff'
import { ROLE_NAMES, sectionsFor } from '@/lib/ops-nav'
import { queueCounts } from '@/lib/ops-queue'
import OpsShell from '@/components/ops/OpsShell'
import OpsAlerts from '@/components/OpsAlerts'
import EnableAlerts from '@/components/EnableAlerts'

export const dynamic = 'force-dynamic'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Only active staff can use ops pages; staff who must still replace their temporary password are sent to do that.
  // (Each page and API route also checks the exact roles it allows.)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true, active: true, mustChangePassword: true } })
  if (!me || !me.active) redirect('/login')
  if (!STAFF_ROLES.includes(me.role)) redirect('/dashboard')
  if (me.mustChangePassword) redirect('/reset-password?first=1')

  // The menu shows only the pages this role can open, with how many things wait on each.
  const counts = await queueCounts(me.role)
  const sections = sectionsFor(me.role).map((s) => ({
    title: s.title,
    links: s.links.map((l) => ({ href: l.href, label: l.label, icon: l.icon, count: l.queue ? counts[l.queue] : 0 })),
  }))

  return (
    <OpsShell sections={sections} name={me.name} role={ROLE_NAMES[me.role] ?? me.role}>
      <div className="mx-auto max-w-6xl">
        <OpsAlerts />
        <EnableAlerts compact message="Turn on alerts on this device so you hear when tonight's plan is ready or an order needs a driver." />
        {children}
      </div>
    </OpsShell>
  )
}
