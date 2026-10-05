import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import MfaRecoveryForm from '@/components/MfaRecoveryForm'
import { PageHeader } from '@/components/ui'

export default async function MfaRecoveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || dbUser.role !== 'SUPER_ADMIN') {
    redirect('/ops')
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title="2FA recovery"
        lead="Only after you've confirmed who is asking through another channel, such as a phone call to a number you already have. This removes their current 2FA; they set it up again at their next sign-in."
      />
      <MfaRecoveryForm />
    </div>
  )
}
