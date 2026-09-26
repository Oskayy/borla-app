import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MANDATORY_MFA_ROLES } from '@/lib/mfa'
import MfaEnrollForm from '@/components/MfaEnrollForm'

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
    <div style={{ maxWidth: 440, margin: '60px auto', padding: '0 20px' }}>
      <div className="panel">
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Two-Factor Authentication Required</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
          Your role ({dbUser.role}) requires 2FA before you can access ops tools. This takes about a minute.
        </p>
        <MfaEnrollForm redirectTo="/ops" />
      </div>
    </div>
  )
}