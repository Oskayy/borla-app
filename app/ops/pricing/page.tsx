import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PricingRuleForm from '@/components/PricingRuleForm'

export default async function PricingRulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !['SUPER_ADMIN', 'FINANCE'].includes(dbUser.role)) {
    redirect('/ops')
  }

  const [rules, sizes] = await Promise.all([
    prisma.pricingRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: { binPrices: { include: { binSize: true } } },
    }),
    prisma.binSize.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, label: true, litres: true },
    }),
  ])

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Pricing Rules</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Price = (base fee + Σ (bin fee + per-bin charge) × count) × zone multiplier − recyclable discount + hazard
        surcharge + late surcharge.
      </p>

      <PricingRuleForm sizes={sizes} />

      <h2 style={{ fontSize: 16, margin: '24px 0 12px' }}>History</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((rule) => {
          const bins = [...rule.binPrices]
            .sort((a, b) => a.binSize.sortOrder - b.binSize.sortOrder)
            .map((bp) => `${bp.binSize.label} GHS ${bp.fee}`)
            .join(' · ')
          return (
            <div key={rule.id} className="panel" style={{ opacity: rule.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{rule.name}</span>
                {rule.active && <span style={{ fontSize: 11, color: '#2F7A4D', fontWeight: 600 }}>ACTIVE</span>}
              </div>
              <p style={{ fontSize: 13, color: '#444' }}>{bins || 'No bin prices'}</p>
              <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                Base GHS {rule.baseFee} · Per-bin GHS {rule.volumeRate} · Hazard GHS {rule.hazardSurcharge} · Late GHS{' '}
                {rule.lateSurcharge} · Recyclable −{rule.separatedDiscountPercent}% · Platform fee {rule.platformFeePercent}% ·
                Created {new Date(rule.createdAt).toLocaleDateString()}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
