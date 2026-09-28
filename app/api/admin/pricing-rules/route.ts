import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { logAdminAction } from '@/lib/admin-log'

const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET() {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  const rules = await prisma.pricingRule.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'pricing_change', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 80)
  const baseFee = inRange(body?.baseFee, 0, 1000)
  const volumeRate = inRange(body?.volumeRate, 0, 1000)
  const zoneMultiplier = inRange(body?.zoneMultiplier, 0.1, 10)
  const hazardSurcharge = inRange(body?.hazardSurcharge, 0, 1000)
  const discount = inRange(body?.separatedDiscountPercent, 0, 100)

  if (!name || baseFee === null || volumeRate === null || zoneMultiplier === null || hazardSurcharge === null || discount === null) {
    return NextResponse.json({ error: 'Please check the pricing values (all fields are required)' }, { status: 400 })
  }

  const rule = await prisma.$transaction(async (tx) => {
    await tx.pricingRule.updateMany({ where: { active: true }, data: { active: false } })
    return tx.pricingRule.create({
      data: {
        name,
        baseFee,
        volumeRate,
        zoneMultiplier,
        hazardSurcharge,
        separatedDiscountPercent: discount,
        active: true,
      },
    })
  })

  await logAdminAction(
    auth.user.id,
    'PRICING_RULE_ACTIVATED',
    rule.id,
    `"${name}": base ${baseFee}, per-bag ${volumeRate}, zone x${zoneMultiplier}, hazard ${hazardSurcharge}, recyclable discount ${discount}%`
  )

  return NextResponse.json({ success: true, rule })
}