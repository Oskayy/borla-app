import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import OpsNav from '@/components/OpsNav'
import OpsAlerts from '@/components/OpsAlerts'
import EnableAlerts from '@/components/EnableAlerts'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Suspended staff, and staff who must still replace their temporary password, can't use ops pages.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { active: true, mustChangePassword: true } })
    if (me && !me.active) redirect('/login')
    if (me?.mustChangePassword) redirect('/reset-password?first=1')
  }

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