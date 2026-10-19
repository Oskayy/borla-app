import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PricingRuleForm from '@/components/PricingRuleForm'
import { PageHeader } from '@/components/ui'
import { SectionTitle } from '@/components/ops/kit'
import RuleActions from '@/components/ops/RuleActions'
import { dateLabel } from '@/lib/format'
import TaxForm from '@/components/ops/TaxForm'
import TierPriceForm from '@/components/ops/TierPriceForm'
import { getTierPrices } from '@/lib/tier-price-server'

export default async function PricingRulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !['SUPER_ADMIN', 'FINANCE'].includes(dbUser.role)) {
    redirect('/ops')
  }

  const [rules, sizes, tax, tierPrices, following] = await Promise.all([
    prisma.pricingRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: { binPrices: { include: { binSize: true } } },
    }),
    prisma.binSize.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, label: true, litres: true },
    }),
    prisma.operatingSettings.findUnique({
      where: { id: 1 },
      select: { vatPercent: true, nhilPercent: true, getfundPercent: true, withholdingPercent: true },
    }),
    getTierPrices(),
    prisma.zone.groupBy({ by: ['tier'], where: { followsTier: true }, _count: { _all: true } }),
  ])

  return (
    <div>
      <PageHeader
        title="Pricing"
        lead="Price = (base fee + each bin's fee and per-bin charge) × the zone multiplier (its tier's, or its own), minus the recyclable discount, plus hazard and late surcharges. Worked out on the server; the browser never sets a price. The platform fee is fixed on each order when it is priced, so a change here only affects new bookings."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-8">
      <PricingRuleForm sizes={sizes} />

      <div className="grid gap-6">
      <TierPriceForm current={tierPrices} following={Object.fromEntries(following.map((f) => [f.tier, f._count._all]))} />

      <TaxForm current={tax ?? { vatPercent: 0, nhilPercent: 0, getfundPercent: 0, withholdingPercent: 0 }} />

      <section aria-labelledby="h-price-history">
        <SectionTitle id="h-price-history">History</SectionTitle>
        <ul className="divide-y divide-line rounded-card bg-surface shadow-card ring-1 ring-line/70">
          {rules.map((rule) => {
            const bins = [...rule.binPrices]
              .sort((a, b) => a.binSize.sortOrder - b.binSize.sortOrder)
              .map((bp) => `${bp.binSize.label} GHS ${bp.fee}`)
              .join(' · ')
            return (
              <li key={rule.id} className="p-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-semibold ${rule.active ? '' : 'text-ink-3'}`}>{rule.name}</span>
                  <RuleActions kind="pricing" id={rule.id} active={rule.active} label={rule.name} />
                </div>
                <p className="mt-1 text-[15px] tabular-nums text-ink-2">{bins || 'No bin prices'}</p>
                <p className="mt-1 text-sm tabular-nums text-ink-3">
                  Base GHS {rule.baseFee} · per bin GHS {rule.volumeRate} · hazard GHS {rule.hazardSurcharge} · late GHS {rule.lateSurcharge} ·
                  recyclable −{rule.separatedDiscountPercent}% · platform fee {rule.platformFeePercent}% · attempt fee {rule.attemptFeePercent}% · created {dateLabel(rule.createdAt)}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
      </div>
      </div>
    </div>
  )
}
