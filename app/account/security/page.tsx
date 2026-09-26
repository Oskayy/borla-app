import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import MfaEnrollForm from '@/components/MfaEnrollForm'
import DisableMfaButton from '@/components/DisableMfaButton'

export default async function AccountSecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified')

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Account Security</h1>
      <div className="panel">
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Two-Factor Authentication</h2>
        {verifiedFactor ? (
          <div>
            <p style={{ fontSize: 13, color: '#2F7A4D', marginBottom: 12 }}>2FA is currently enabled on your account.</p>
            <DisableMfaButton factorId={verifiedFactor.id} />
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Add an extra layer of security to your account with an authenticator app.
            </p>
            <MfaEnrollForm />
          </div>
        )}
      </div>
    </div>
  )
}