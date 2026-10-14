import { redirect } from 'next/navigation'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { AccountGroup, AccountRow, BackToAccount } from '@/components/driver/AccountRow'

export const dynamic = 'force-dynamic'

export default async function DriverSecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const factors = await supabase.auth.mfa.listFactors()
  const has2fa = !!factors.data?.totp?.some((f) => f.status === 'verified')

  return (
    <div className="max-w-4xl">
      <BackToAccount />
      <h1 className="anim-rise mb-5 text-[clamp(1.75rem,2.8vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.03em]">Sign-in and security</h1>
      <AccountGroup title="Sign-in">
        <AccountRow
          href="/reset-password"
          icon={KeyRound}
          title="Change password"
          desc="Pick a new password. Other phones signed in to your account are signed out."
        />
        <AccountRow
          href="/account/security"
          icon={ShieldCheck}
          title="Two-factor authentication"
          value={has2fa ? 'On' : 'Off'}
          desc="Also asks for a 6-digit code from an app on your phone when you sign in, so a stolen password isn't enough."
        />
      </AccountGroup>
    </div>
  )
}
