import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import MfaRecoveryForm from '@/components/MfaRecoveryForm'
import { ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { PANEL } from '@/components/ops/kit'

export default async function MfaRecoveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || dbUser.role !== 'SUPER_ADMIN') {
    redirect('/ops')
  }

  return (
    <div>
      <PageHeader
        title="2FA recovery"
        lead="Only after you've confirmed who is asking through another channel, such as a phone call to a number you already have. This removes their current 2FA; they set it up again at their next sign-in."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-8">
        <MfaRecoveryForm />
        <aside aria-labelledby="h-before" className={PANEL}>
          <h2 id="h-before" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <ShieldAlert aria-hidden className="size-5 text-warn-deep" /> Before you reset someone&apos;s 2FA
          </h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] text-ink-2">
            <li>Call them on a number you already have for them, not one given in the request.</li>
            <li>Never act on a request that came only by email, chat or text.</li>
            <li>After the reset they set up 2-step verification again at their next sign-in.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
