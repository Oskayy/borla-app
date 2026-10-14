import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { STAFF_ROLES } from '@/lib/staff'
import MfaEnrollForm from '@/components/MfaEnrollForm'
import DisableMfaButton from '@/components/DisableMfaButton'
import { Card, PageHeader } from '@/components/ui'

// Two-step sign-in for any account (staff must have it; customers and drivers may choose it).
export default async function AccountSecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: factorsData }, me] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }),
  ])
  const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified')
  const staff = !!me && STAFF_ROLES.includes(me.role)

  return (
    <div data-surface="new" className={`min-h-dvh bg-canvas px-4 py-8 sm:py-14 ${staff ? 'theme-ops' : ''}`}>
      <div className="mx-auto max-w-xl">
        <PageHeader
          back={{ href: staff ? '/ops' : '/dashboard', label: staff ? 'Back to ops' : 'Back' }}
          title="Two-step sign-in"
          lead="After your password, Trashit also asks for a 6-digit code from an app on your phone, so a stolen password alone can't open your account."
        />
        <Card className="anim-rise">
          {verifiedFactor ? (
            <div className="grid gap-4">
              <p className="flex items-center gap-3 rounded-[16px] bg-ok-wash p-4 font-semibold text-ok-deep">
                <ShieldCheck aria-hidden className="size-5 shrink-0" /> Two-step sign-in is on.
              </p>
              <DisableMfaButton factorId={verifiedFactor.id} />
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="flex items-center gap-3 rounded-[16px] bg-canvas p-4 text-[15px] text-ink-2">
                <ShieldOff aria-hidden className="size-5 shrink-0 text-ink-3" /> Two-step sign-in is off.
              </p>
              <MfaEnrollForm />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
