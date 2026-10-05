import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PayoutRuleForm from '@/components/PayoutRuleForm'
import { PageHeader } from '@/components/ui'
import { SectionTitle } from '@/components/ops/kit'
import RuleActions from '@/components/ops/RuleActions'
import { dateLabel } from '@/lib/format'

export default async function PayoutRulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !['SUPER_ADMIN', 'FINANCE'].includes(dbUser.role)) {
    redirect('/ops')
  }

  const rules = await prisma.payoutRule.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader title="Payout rules" lead="Drivers are paid part of each stop at pickup and the rest once the unload is verified." />

      <PayoutRuleForm />

      <section aria-labelledby="h-history">
        <SectionTitle id="h-history">History</SectionTitle>
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
              <span className={rule.active ? '' : 'text-ink-3'}>
                <span className="font-semibold tabular-nums">
                  {rule.pickupPercent}% at pickup · {rule.disposalPercent}% at unload
                </span>
                <span className="block text-sm text-ink-3">Created {dateLabel(rule.createdAt)}</span>
              </span>
              <RuleActions kind="payout" id={rule.id} active={rule.active} label={`${rule.pickupPercent}% / ${rule.disposalPercent}%`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
