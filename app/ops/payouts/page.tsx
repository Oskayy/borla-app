import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PayoutRuleForm from '@/components/PayoutRuleForm'

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
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Payout Rules</h1>

      <PayoutRuleForm />

      <h2 style={{ fontSize: 16, margin: '24px 0 12px' }}>History</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((rule) => (
          <div key={rule.id} className="panel" style={{ opacity: rule.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>
                {rule.pickupPercent}% pickup / {rule.disposalPercent}% disposal
              </span>
              {rule.active && (
                <span style={{ fontSize: 11, color: '#2F7A4D', fontWeight: 600 }}>ACTIVE</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#999' }}>
              Created {new Date(rule.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}