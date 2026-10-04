import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { STAFF_ROLES } from '@/lib/staff'
import OpsNav from '@/components/OpsNav'
import OpsAlerts from '@/components/OpsAlerts'
import EnableAlerts from '@/components/EnableAlerts'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Only active staff can use ops pages; staff who must still replace their temporary password are sent to do that.
  // (Each page and API route also checks the exact roles it allows.)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, active: true, mustChangePassword: true } })
  if (!me || !me.active) redirect('/login')
  if (!STAFF_ROLES.includes(me.role)) redirect('/dashboard')
  if (me.mustChangePassword) redirect('/reset-password?first=1')

  return (
    <div>
      <OpsNav />
      <main style={{ padding: '24px' }}>
        <OpsAlerts />
        <EnableAlerts
          compact
          message="Turn on alerts on this device so you hear when tonight's plan is ready or an order needs a driver."
        />
        {children}
      </main>
    </div>
  )
}