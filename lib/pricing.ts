import { prisma } from '@/lib/prisma'

export const WASTE_TYPES = ['general', 'recyclable']

export function parseOrderInput(body: any): { bagCount: number; wasteType: string } | null {
  const bagCount = body?.bagCount
  const wasteType = body?.wasteType
  if (!Number.isInteger(bagCount) || bagCount < 1 || bagCount > 10) return null
  if (typeof wasteType !== 'string' || !WASTE_TYPES.includes(wasteType)) return null
  return { bagCount, wasteType }
}

export async function computeQuote(input: { bagCount: number; wasteType: string }) {
  const rule = await prisma.pricingRule.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!rule) return null

  let price = rule.baseFee + rule.volumeRate * input.bagCount * rule.zoneMultiplier

  if (input.wasteType === 'recyclable') {
    price = price * (1 - rule.separatedDiscountPercent / 100)
  }

  return { price: Math.round(price * 100) / 100, ruleId: rule.id }
}