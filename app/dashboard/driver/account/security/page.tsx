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
    <div className="mx-auto max-w-2xl">
      <BackToAccount />
      <h1 className="mb-5 text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Sign-in and security</h1>
      <AccountGroup title="Sign-in">
        <AccountRow href="/reset-password" icon={KeyRound} title="Change password" />
        <AccountRow
          href="/account/security"
          icon={ShieldCheck}
          title="Two-factor authentication"
          value={has2fa ? 'On' : 'Off'}
          info="Asks for a code from an authenticator app when you sign in, so a stolen password isn't enough."
        />
      </AccountGroup>
    </div>
  )
}
