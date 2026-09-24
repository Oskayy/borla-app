import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const { bagCount } = await req.json()

  const rule = await prisma.pricingRule.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!rule) {
    return NextResponse.json({ error: 'No active pricing rule found' }, { status: 500 })
  }

  const price =
    rule.baseFee + rule.volumeRate * bagCount * rule.zoneMultiplier + rule.hazardSurcharge

  return NextResponse.json({
    price,
    ruleId: rule.id, // saved with the order later, so every quote is traceable
  })
}