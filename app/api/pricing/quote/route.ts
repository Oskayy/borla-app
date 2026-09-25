import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { bagCount, wasteType, hazardous } = await req.json()

  const rule = await prisma.pricingRule.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!rule) {
    return NextResponse.json({ error: 'No active pricing rule found' }, { status: 500 })
  }

  let price = rule.baseFee + rule.volumeRate * bagCount * rule.zoneMultiplier

  if (hazardous) {
    price += rule.hazardSurcharge
  }

  if (wasteType === 'recyclable') {
    price = price * (1 - rule.separatedDiscountPercent / 100)
  }

  return NextResponse.json({
    price,
    ruleId: rule.id,
  })
}