import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MANDATORY_MFA_ROLES } from '@/lib/mfa'
import { ROLE_NAMES } from '@/lib/ops-nav'
import MfaEnrollForm from '@/components/MfaEnrollForm'
import { Card, PageHeader } from '@/components/ui'

// Staff must set up two-step sign-in before any ops page opens.
export default async function SecuritySetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) redirect('/login')

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const hasVerifiedFactor = factorsData?.totp?.some((f) => f.status === 'verified')

  if (hasVerifiedFactor) {
    redirect('/ops')
  }

  if (!MANDATORY_MFA_ROLES.includes(dbUser.role)) {
    redirect('/dashboard')
  }

  return (
    <div data-surface="new" className="theme-ops min-h-dvh bg-canvas px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Set up two-step sign-in"
          lead={`As ${ROLE_NAMES[dbUser.role] ?? dbUser.role}, you need a 6-digit code from an app on your phone each time you sign in. It takes about a minute.`}
        />
        <Card className="anim-rise">
          <MfaEnrollForm redirectTo="/ops" />
        </Card>
      </div>
    </div>
  )
}
