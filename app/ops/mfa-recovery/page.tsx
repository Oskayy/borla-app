import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import MfaRecoveryForm from '@/components/MfaRecoveryForm'

export default async function MfaRecoveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || dbUser.role !== 'SUPER_ADMIN') {
    redirect('/ops')
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>2FA Recovery</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Use this only after verifying the requester&apos;s identity through another channel (phone call, known details, etc).
        This removes their current 2FA — they&apos;ll be prompted to set it up again next login.
      </p>
      <MfaRecoveryForm />
    </div>
  )
}